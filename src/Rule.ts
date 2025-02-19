import { IBuildPath, IPathRoots, Path } from './Path.js';
import { isAbsolute } from 'node:path';
import { Writable } from 'node:stream';
import { spawn } from 'node:child_process';

/**
 * A rule to build targets from sources
 */
export interface IRule {
	/**
	 * Target files that are outputs of the rule's build
	 */
	targets(): IBuildPath | IBuildPath[];

	/**
	 * Files that the rule needs to build recipe
	 */
	prereqs?(): Path | Path[];

	/**
	 * Generate targets from sources
	 */
	recipe?(args: RecipeArgs): Promise<boolean | void> | boolean | void;
}

export class RecipeArgs {
	private _roots: IPathRoots;
	private _postreqs: Set<string>;
	readonly logStream: Writable;

	constructor(roots: IPathRoots, postreqs: Set<string>, logStream: Writable) {
		this._roots = roots;
		this._postreqs = postreqs;
		this.logStream = logStream;
	}

	abs(path: Path): string {
		return path.abs(this._roots);
	}

	absAll(paths: Iterable<Path>): string[];
	absAll(...paths: Path[]): string[];
	absAll(
		pathOrPaths: Path | Iterable<Path>,
		...rest: Path[]
	): string | string[] {
		const out: string[] = [];
		let iter: Iterable<Path>;

		if (!isIterable(pathOrPaths)) {
			out.push(pathOrPaths.abs(this._roots));
			iter = rest;
		}

		for (const p of iter) out.push(p.abs(this._roots));

		return out;
	}

	addPostreq(abs: string): void {
		if (!isAbsolute(abs))
			throw new Error(
				`addPostreq: argument must be an absolute path. '${abs}' given.`,
			);

		this._postreqs.add(abs);
	}

	async spawn(cmd: string, cmdArgs: string[]): Promise<boolean> {
		const proc = spawn(cmd, cmdArgs, { stdio: 'pipe' });

		proc.stdout.pipe(this.logStream, { end: false });
		proc.stderr.pipe(this.logStream, { end: false });

		return new Promise<boolean>((res) => {
			proc.on('close', (code) => {
				this.logStream.end();
				res(code === 0);
			});
		});
	}
}

export function rulePrereqs(rule: IRule): Path[] {
	if (typeof rule.prereqs === 'function') {
		return normalize(rule.prereqs());
	}

	return [];
}

export function ruleTargets(rule: IRule): IBuildPath[] {
	return normalize(rule.targets());
}

export type RecipeFunction = (
	args: RecipeArgs,
) => Promise<boolean | void> | boolean | void;

export function ruleRecipe(
	rule: IRule,
): (args: RecipeArgs) => Promise<boolean> | null {
	if (rule.recipe) {
		return async (args: RecipeArgs) => {
			const result = await rule.recipe(args);
			if (typeof result === 'undefined') return true;
			return result;
		};
	}

	return null;
}

type OneOrMany<T> = T | T[];

function normalize<T>(val: OneOrMany<T>): T[] {
	if (Array.isArray(val)) {
		return val;
	}

	return [val];
}

function isIterable<T>(obj: object): obj is Iterable<T> {
	return (
		obj && Symbol.iterator in obj && typeof obj[Symbol.iterator] === 'function'
	);
}
