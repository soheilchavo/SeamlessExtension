import { RealtimeVision } from '@overshoot/sdk'

const API_KEY = 'ovs_148da6c73eff6fdde6431e7bc82e0dd8';


console.log('Script loaded')

let latestClothingData = null
let vision = null

document.addEventListener('DOMContentLoaded', async () => {
    // Populate camera dropdown
    async function loadCameras() {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter(d => d.kind === 'videoinput')
        const select = document.getElementById('camera-select')

        select.innerHTML = cameras.map((cam, i) =>
            `<option value="${cam.deviceId}">${cam.label || 'Camera ' + (i + 1)}</option>`
        ).join('')
    }

    // Load cameras on page load
    await loadCameras()

    async function startVisionWithCamera() {
        const select = document.getElementById('camera-select');
        const deviceId = select.value;

        if (!deviceId) {
            document.getElementById('results').innerText = 'Please select a camera first!';
            return;
        }

        if (vision) {
            await vision.stop();
        }

        vision = new RealtimeVision({
            apiUrl: 'https://cluster1.overshoot.ai/api/v0.2',
            apiKey: API_KEY,
            prompt: 'Identify all clothing items visible in the image. For each item, describe: type, color, pattern, and style. If no clothing is found, say "No clothing found".',
            source: { type: 'camera', cameraFacing: 'user' },
            outputSchema: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string' },
                                color: { type: 'string' },
                                pattern: { type: 'string' },
                                style: { type: 'string' },
                            }
                        }
                    }
                }
            },
            onResult: (result) => {
                console.log('Got result:', result);
                try {
                    // Handle different result formats
                    const data = typeof result === 'string' ? JSON.parse(result) :
                        result.result ? (typeof result.result === 'string' ? JSON.parse(result.result) : result.result) :
                            result;
                    latestClothingData = data;
                    console.log('Parsed clothing data:', latestClothingData);
                    document.getElementById('results').innerText = JSON.stringify(latestClothingData, null, 2);
                } catch (e) {
                    console.log('Parse error:', e);
                    console.log('Raw result:', result);
                    document.getElementById('results').innerText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                }
            },
            onMessage: (message) => {
                console.log('Got message:', message);
            },
            onStatusChange: (status) => {
                console.log('Status changed:', status);
                document.getElementById('results').innerText = 'Status: ' + status;
            },
            onError: (err) => {
                console.error('Vision error:', err);
                document.getElementById('results').innerText = 'An error occurred: ' + (err.message || JSON.stringify(err));
            }
        });

        await vision.start();
        console.log('Vision started with camera.');
    }

    document.getElementById('find-btn').onclick = () => {
        document.getElementById('results').innerText = 'Detecting clothing...';
        startVisionWithCamera();
    };

    // Start camera stream when Start button is clicked
    document.getElementById('start-btn').onclick = async () => {
        const select = document.getElementById('camera-select');
        const deviceId = select.value;
        const video = document.getElementById('preview');

        console.log('Starting camera with device:', deviceId);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: deviceId ? { exact: deviceId } : undefined }
            });
            video.srcObject = stream;
            console.log('Camera started successfully');

            // Reload cameras to get proper labels after permission granted
            await loadCameras();
        } catch (err) {
            console.error('Error starting camera:', err);
            document.getElementById('results').innerText = 'Error starting camera: ' + err.message;
        }
    };
})