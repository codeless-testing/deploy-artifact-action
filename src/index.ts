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
        const apiUrl = 'https://api.codeless-tests.com/deploy/upload-zip';

        /* 1️⃣  Get the bytes we will POST */
        let fileBuffer: Buffer;
        let fileName:   string;

        const stat = await fs.stat(sourcePath);
        if (stat.isFile()) {
            fileBuffer = await fs.readFile(sourcePath);
            fileName   = path.basename(sourcePath);
        } else if (stat.isDirectory()) {
            // zip the directory into RUNNER_TEMP
            const tempZip = path.join(
                process.env['RUNNER_TEMP'] ?? os.tmpdir(),
                `payload-${Date.now()}.zip`
            );
            await exec.exec('zip', ['-r', tempZip, '.'], {cwd: sourcePath});
            fileBuffer = await fs.readFile(tempZip);
            fileName   = path.basename(tempZip);
            info(`📦 Zipped folder ${sourcePath} → ${tempZip}`);
        } else {
            throw new Error(`${sourcePath} is neither file nor directory`);
        }

        /* 2️⃣  Build multipart/form-data */
        const formData = new FormData();

        // 👇 wrap Buffer in a Blob (or File) so the type matches
        const fileBlob = new Blob([fileBuffer], { type: 'application/zip' });
        formData.append('artifact', fileBlob, fileName);   // filename is the 3rd arg

        /* 3️⃣  POST to backend */
        info(`🚀 Uploading ${fileBuffer.byteLength} bytes to ${apiUrl}`);
        const res = await fetch(apiUrl, {
            method: 'POST',
            body:   formData,  // do NOT set Content-Type yourself!
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
