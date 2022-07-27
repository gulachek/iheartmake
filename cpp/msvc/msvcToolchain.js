const { Toolchain } = require('../toolchain');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { LineReader } = require('./lineReader');

class MsvcToolchain extends Toolchain {
    get objectExt() { return 'obj'; }
    get archiveExt() { return 'lib'; }
    get executableExt() { return 'exe'; }

    async compile(opts) {
        const out = path.parse(opts.outputPath);
        const args = [
            '/c', opts.srcPath,
            '/EHsc',
            `/Fo${out.base}`,
            '/showIncludes'
        ];

        switch (opts.cppVersion) {
            case 20:
            case 17:
            case 14:
                args.push(`/std:c++${opts.cppVersion}`);
                break;
            default:
                throw new Error(`msvc does not support c++${opts.cppVersion}`);
                break;
        }

        for (const i of opts.includes) {
            args.push('/I');
            args.push(i);
        }

        if (opts.isDebug) {
            args.push('/Od');
        } else {
            args.push('/Ot');
        }

        const depfile = fs.createWriteStream(opts.depfilePath, 'utf8');
        let dfProm = new Promise((resolve) => {
            depfile.on('ready', resolve);
        });

        const proc = spawn('cl', args, {
            stdio: ['inherit', 'pipe', 'inherit'],
            cwd: out.dir
        });

        const lines = new LineReader(proc.stdout);
        lines.on('line', async (l) => {
            const match = l.match(/^Note: including file: +([^ ](.|\s)+)$/);
            if (match) {
                await dfProm;
                dfProm = new Promise((resolve) => {
                    depfile.write(match[1], resolve);
                });
            } else {
                process.stdout.write(l);
            }
        });

        const depfileDone = new Promise((resolve) => {
            lines.on('end', () => {
                dfProm.then(() => depfile.end());
                resolve();
            })
        });

        await depfileDone;
        return proc;
    }

    archive(opts) {
        const args = [
            `/OUT:${opts.outputPath}`,
            ...opts.objects
        ];
        return spawn('lib', args, {
            stdio: 'inherit'
        });
    }

    linkExecutable(opts) {
        const args = [
            `/OUT:${opts.outputPath}`,
            '/DEBUG',
            ...opts.objects
        ];
        return spawn('link', args, {
            stdio: 'inherit'
        });
    }

    *depfileEntries(path) {
        const contents = fs.readFileSync(path, { encoding: 'utf8' });
        const entries = contents.split('\r\n');
        for (const entry of entries) {
            if (entry) {
                yield entry;
            }
        }

        return;
    }
}

module.exports = {
    MsvcToolchain
};
