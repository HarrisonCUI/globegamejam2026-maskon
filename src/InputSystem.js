import * as mpHolistic from '@mediapipe/holistic';
import * as mpCamera from '@mediapipe/camera_utils';

export class InputSystem {
    constructor(videoElement, onResultsCallback) {
        this.videoElement = videoElement;

        // Robust import handling for Production Build - Holistic
        const Holistic = mpHolistic.Holistic || mpHolistic.default?.Holistic || window.Holistic;
        if (!Holistic) {
            console.error("Critical Error: Holistic class not found in import", mpHolistic);
            throw new Error("Mediapipe Holistic class could not be loaded.");
        }

        // Robust import handling for Production Build - Camera
        const Camera = mpCamera.Camera || mpCamera.default?.Camera || window.Camera;
        if (!Camera) {
            console.error("Critical Error: Camera class not found in import", mpCamera);
            throw new Error("Mediapipe Camera class could not be loaded.");
        }

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
