import * as exec from '@actions/exec';     // optional, for zipping
import * as io from '@actions/io';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {getInput, info, setFailed} from "@actions/core";


async function run() {
    try {
        /* gather inputs */
        const sourcePath = getInput('source_dir');
        const apiUrl = 'https://api.codeless-tests.com';

        /* 1️⃣  Get the bytes we will POST */
        let fileBuffer: Buffer;

        const stat = await fs.stat(sourcePath);
        if (stat.isFile()) {
            // direct file (already e.g. a zip)
            fileBuffer = await fs.readFile(sourcePath);
        } else if (stat.isDirectory()) {
            // zip the directory into RUNNER_TEMP
            const tempZip = path.join(
                process.env['RUNNER_TEMP'] ?? os.tmpdir(),
                `payload-${Date.now()}.zip`
            );
            await exec.exec('zip', ['-r', tempZip, '.'], {cwd: sourcePath});
            fileBuffer = await fs.readFile(tempZip);
            info(`📦 Zipped folder ${sourcePath} → ${tempZip}`);
        } else {
            throw new Error(`${sourcePath} is neither file nor directory`);
        }

        /* 2️⃣  Upload to backend */
        info(`🚀 Uploading ${fileBuffer.byteLength} bytes to ${apiUrl}`);

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: fileBuffer,
            // increase the limit if your payload is large
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(
                `Backend responded ${res.status} ${res.statusText}\n${text}`
            );
        }

        info('✅ Upload completed');
    } catch (e) {
        setFailed(e instanceof Error ? e.message : String(e));
    }

}


run();
