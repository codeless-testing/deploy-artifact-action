import {
    getInput,
    getBooleanInput,
    info,
    setOutput,
    setFailed
} from '@actions/core';
import {DefaultArtifactClient} from '@actions/artifact';
import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function run(): Promise<void> {
    try {
        /* ───────── inputs ───────── */
        const artifactName   = getInput('artifact_name', {required: true});
        const apiUrl         = getInput('api_url',       {required: true});
        const apiToken       = getInput('api_token',     {required: true});
        const poll           = getBooleanInput('poll');
        const pollInterval   = Number(getInput('poll_interval_seconds')) || 15;
        const pollTimeoutMin = Number(getInput('poll_timeout_minutes'))  || 30;

        /* ─── download artifact with latest API ─── */
        const artifactClient = new DefaultArtifactClient();

        // 1️⃣ look‑up by name to get the id
        const {artifact} = await artifactClient.getArtifact(artifactName);
        const {id} = artifact;
        if (!id) throw new Error(`Artifact “${artifactName}” was not found`);

        // 2️⃣ download by id
        const downloadRoot = '.uploaded-artifact';
        const {downloadPath} = await artifactClient.downloadArtifact(id, {
            path: downloadRoot          // extraction target
        });
        if (!downloadPath) {
            return ;
        }

        // we expect a single file (zip, tgz, …) inside the folder
        const fileName = fs.readdirSync(downloadPath)[0];
        if (!fileName) throw new Error(`Artifact “${artifactName}” is empty`);
        const fileBuffer = fs.readFileSync(path.join(downloadPath, fileName));

        info(`📦 Downloaded artifact ${artifactName} (${fileName})`);

        /* ─── upload to your backend ─── */
        const uploadResp = await axios.post(apiUrl, fileBuffer, {
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/octet-stream'
            },
            maxBodyLength: Infinity
        });

        info(`🚀 Uploaded — HTTP ${uploadResp.status}`);

        // backend contract: {status:'succeeded'|'failed'} or 202→statusUrl
        let status    : string | undefined = uploadResp.data?.status;
        let statusUrl : string | undefined =
            uploadResp.data?.statusUrl || uploadResp.headers['location'];

        if (!poll) {
            setOutput('result', status ?? 'unknown');
            return;
        }

        /* ─── polling loop ─── */
        if (!statusUrl && status) {
            status === 'succeeded'
                ? setOutput('result', 'success')
                : setFailed(`Backend returned status ${status}`);
            return;
        }
        if (!statusUrl) throw new Error('Backend did not supply statusUrl');

        info(`⏳ Waiting for backend. Polling ${statusUrl}`);
        const deadline = pollTimeoutMin > 0
            ? Date.now() + pollTimeoutMin * 60_000
            : Number.MAX_SAFE_INTEGER;

        while (true) {
            if (Date.now() > deadline) {
                setFailed(`Timed out after ${pollTimeoutMin} minute(s)`);
                return;
            }

            await new Promise(r => setTimeout(r, pollInterval * 1000));
            const pollResp = await axios.get(statusUrl, {
                headers: {Authorization: `Bearer ${apiToken}`}
            });

            status = pollResp.data?.status;
            info(`🔄 Current status: ${status}`);

            if (status === 'succeeded') {
                setOutput('result', 'success');
                return;
            }
            if (status === 'failed') {
                setFailed('Backend reported failure');
                return;
            }
        }
    } catch (err: unknown) {
        setFailed(err instanceof Error ? err.message : String(err));
    }
}

run();
