import { Holistic, FACEMESH_TESSELATION, HAND_CONNECTIONS } from '@mediapipe/holistic'
import { Camera } from '@mediapipe/camera_utils'

export class InputSystem {
    constructor(videoElement, onResultsCallback) {
        this.videoElement = videoElement;
        this.holistic = new Holistic({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            }
        });



        this.holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableFaceLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            refineFaceLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.holistic.onResults(onResultsCallback);


        this.camera = new Camera(videoElement, {
            onFrame: async () => {
                // log("Frame received..."); // Too spammy, but good for one-off check
                if (videoElement.paused) {
                    console.log("Force playing video...");
                    await videoElement.play();
                }
                await this.holistic.send({ image: videoElement });
            },

            width: 640,
            height: 480
        });
    }

    start() {
        return this.camera.start();
    }
}
