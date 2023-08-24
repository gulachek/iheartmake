import { spawn, ChildProcess } from 'node:child_process';
import {
	IRecipe,
	PathLike,
	IBuildPath,
	isBuildPathLike,
	BuildPathGenOpts,
	Path,
	Cookbook,
	RecipeBuildArgs,
} from '../../index.js';

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

function procClosed(proc: ChildProcess): Promise<number> {
	return new Promise<number>((res) => {
		proc.on('close', (code: number) => res(code));
	});
}

export class ClangObjectRecipe implements IRecipe {
	public src: Path;
	public obj: IBuildPath;
	public depfile: IBuildPath;
	public compileCommands: IBuildPath;

	constructor(src: Path, out: IBuildPath) {
		this.src = src;
		this.obj = out;
		this.depfile = out.dir().join(out.basename + '.depfile');
		this.compileCommands = out
			.dir()
			.join(out.basename + '.compile_commands.json');
	}

	targets() {
		return {
			obj: this.obj,
			depfile: this.depfile,
			cmds: this.compileCommands,
		};
	}

	sources() {
		return this.src;
	}

	async buildAsync(args: RecipeBuildArgs): Promise<boolean> {
		const { sources, targets } = args.paths<ClangObjectRecipe>();
		const { obj, depfile, cmds } = targets;

		const clangArgs = [sources, '-c', '-o', obj];
		clangArgs.push('-fcolor-diagnostics');
		clangArgs.push('-MMD', '-MF', depfile);
		clangArgs.push('-I', join(dirname(sources), 'include'));
		clangArgs.push('-MJ', cmds);

		const proc = spawn('c++', clangArgs);
		proc.stdout.pipe(args.logStream);
		proc.stderr.pipe(args.logStream);
		const exitCode = await procClosed(proc);
		if (exitCode !== 0) return false;

		const depfileContents = await readFile(depfile, 'utf8');
		const depfileLines = depfileContents.split('\n');
		depfileLines.shift(); // get rid of self
		for (const dep of depfileLines) {
			if (!dep) continue;
			if (dep.endsWith(' \\')) args.addSrc(dep.slice(2, dep.length - 2));
			else args.addSrc(dep.slice(2));
		}

		return true;
	}
}

export function addClangObject(
	book: Cookbook,
	src: PathLike,
	genOpts?: BuildPathGenOpts,
) {
	const srcPath = Path.src(src);
	const destPath = isBuildPathLike(genOpts)
		? Path.build(genOpts)
		: Path.gen(srcPath, { ext: '.o', ...genOpts });

	const obj = new ClangObjectRecipe(srcPath, destPath);
	book.add(obj);

	return obj;
}
