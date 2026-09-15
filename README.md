# VissionAssistant

**VissionAssistant** is an AI-powered mobile application designed to assist visually impaired users with real-time perception of objects, obstacles, text, and Vietnamese currency.

The application combines computer vision, speech recognition, depth estimation, and multimodal feedback to provide contextual information through voice, vibration, and visual interfaces.

[![Repository](https://img.shields.io/badge/GitHub-VissionAssistant-black?logo=github)](https://github.com/Yangshunhui716/VissionAssistant)

## Features

* **Real-time obstacle detection**

  * Detects potential obstacles in the user's field of view.
  * Tracks detected obstacles across consecutive frames.
  * Estimates relative position and approximate distance.
  * Analyzes whether an obstacle is static or approaching.
  * Provides prioritized warnings for potentially dangerous obstacles.

* **Object recognition and search**

  * Recognizes common objects in the environment.
  * Allows users to search for a specific object through voice commands.
  * Uses spatial and depth information to describe detected objects.

* **Vietnamese currency recognition**

  * Detects and identifies Vietnamese banknotes using a dedicated YOLO model.

* **Text recognition**

  * Captures text from the camera and recognizes it using Google ML Kit.

* **Voice interaction**

  * Supports voice commands using Vosk.
  * Provides hands-free interaction for activating application functions.

* **Multimodal feedback**

  * Provides spoken feedback through text-to-speech.
  * Uses vibration for important system states and notifications.
  * Displays relevant information through the mobile interface.

## AI Processing Pipeline

```text
Camera Frame
     │
     ▼
Frame Quality Analysis
     │
     ├── Invalid / Low-quality Frame
     │          └── Skip processing
     │
     ▼
Image Preprocessing
(Rotation → Scaling → Padding → Normalization)
     │
     ├───────────────┬────────────────┬───────────────┐
     ▼               ▼                ▼               ▼
YOLO Object      YOLO Currency      OCR          MiDaS
Detection        Detection          (ML Kit)     Depth Estimation
     │               │                │               │
     ▼               ▼                ▼               ▼
Object /        Currency          Recognized      Relative
Obstacle        Recognition       Text            Depth
Detection
     │
     ▼
Tracking & Spatial Analysis
     │
     ▼
Threat / Target Analysis
     │
     ▼
Feedback Generation
     │
     ├── Text-to-Speech
     ├── Vibration
     └── User Interface
```

## Obstacle Detection

The obstacle detection pipeline combines object detection, temporal tracking, spatial analysis, and monocular depth estimation.

```text
YOLO Detection
      │
      ▼
Object Filtering
      │
      ▼
Object Tracking
      │
      ├── Position
      ├── Size
      ├── Persistence
      └── Motion
      │
      ▼
Danger Prioritization
      │
      ▼
Threat Analysis
      │
      ▼
MiDaS Depth Estimation
      │
      ▼
Distance & Direction
      │
      ▼
Feedback
```

The system considers several factors when analyzing an obstacle, including its position in the image, bounding-box size, persistence across frames, movement, and estimated relative depth.

## Spatial Analysis

Detected objects are analyzed according to their position within the camera frame and their estimated depth.

The system can describe an object using information such as:

```text
Object name + relative direction + approximate distance
```

For example:

```text
"Người trực diện, cách khoảng 1 mét"
```

Depth estimation is based on the relative depth produced by MiDaS. Distance categories are calibrated empirically for the application rather than interpreted as direct physical measurements.

## AI Models

### YOLO26

VissionAssistant uses custom-trained YOLO26 nano models for real-time object and Vietnamese currency detection.

Two dedicated models are used:

* Object and obstacle detection
* Vietnamese currency detection

The models are exported to TensorFlow Lite for on-device inference.

**Reference**

Jocher, G., Qiu, J., Liu, M., Lyu, S., Akyon, F. C., & Kalfaoglu, M. E. (2026). *Ultralytics YOLO26: Unified Real-Time End-to-End Vision Models*. arXiv:2606.03748.

### MiDaS

MiDaS is used for monocular relative depth estimation from a single camera frame.

The estimated depth is combined with detected object regions to provide approximate distance information.

**Reference**

Ranftl, R., Lasinger, K., Hafner, D., Schindler, K., & Koltun, V. (2022). *Towards Robust Monocular Depth Estimation: Mixing Datasets for Zero-Shot Cross-Dataset Transfer*. IEEE Transactions on Pattern Analysis and Machine Intelligence.

## Technology Stack

| Category            | Technology                                                                           |
| ------------------- | ------------------------------------------------------------------------------------ |
| Mobile Framework    | [React Native](https://reactnative.dev/)                                             |
| UI                  | [React Native Paper](https://callstack.github.io/react-native-paper/)                |
| Camera              | [VisionCamera](https://react-native-vision-camera.com/)                              |
| Object Detection    | [Ultralytics YOLO26](https://docs.ultralytics.com/models/yolo26/)                    |
| Depth Estimation    | [MiDaS](https://github.com/isl-org/MiDaS)                                            |
| On-device Inference | [TensorFlow Lite](https://www.tensorflow.org/lite)                                   |
| Image Processing    | [OpenCV](https://opencv.org/)                                                        |
| Text Recognition    | [Google ML Kit](https://developers.google.com/ml-kit/vision/text-recognition)        |
| Speech Recognition  | [Vosk](https://alphacephei.com/vosk/)                                                |
| Text-to-Speech      | [React Native TTS](https://github.com/ak1394/react-native-tts)                       |
| Motion Sensors      | [React Native Sensors](https://github.com/react-native-sensors/react-native-sensors) |
| Object Search       | [Fuse.js](https://www.fusejs.io/)                                                    |
| Language            | JavaScript / TypeScript                                                              |

## System Architecture

The application is organized into several functional layers:

```text
┌─────────────────────────────────────────────┐
│                 User Interface              │
│          Controls / Status / Feedback       │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│              Application Control            │
│       Vision / Voice / Function States      │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│             Perception & Analysis           │
│  YOLO / MiDaS / OCR / Tracking / Spatial    │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│              Device Interfaces              │
│       Camera / Microphone / Sensors         │
└─────────────────────────────────────────────┘
```

## Voice Interaction

```text
User Speech
     │
     ▼
Vosk Speech Recognition
     │
     ▼
Command Analysis
     │
     ▼
Intent Detection
     │
     ├── Obstacle Detection
     ├── Object Search
     ├── General Recognition
     ├── Currency Recognition
     └── Text Recognition
     │
     ▼
Application Function
     │
     ▼
Feedback
```

The voice interface supports a wake-and-listen interaction model to allow users to activate functions without continuously interacting with the screen.

## Project Structure

```text
VissionAssistant/
├── android/
├── ios/
├── assets/
│   └── model-vn-vn/
├── patches/
├── src/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   └── utils/
├── __tests__/
├── App.tsx
├── package.json
├── package-lock.json
└── README.md
```

## Requirements

* Node.js `>= 22.11.0`
* React Native `0.86.0`
* React `19.2.3`
* Android Studio
* Android SDK
* Android device or emulator

For real-time camera processing, a physical Android device is recommended.

## Installation

Clone the repository:

```bash
git clone https://github.com/Yangshunhui716/VissionAssistant.git
cd VissionAssistant
```

Install dependencies:

```bash
npm install
```

Start Metro:

```bash
npm start
```

Run the Android application:

```bash
npm run android
```

## Performance Considerations

Real-time processing is designed to run locally on the mobile device.

The application reduces unnecessary computation by:

* Processing camera frames at controlled intervals.
* Running depth estimation less frequently than object detection.
* Reusing temporal information through object tracking.
* Filtering irrelevant detections before further analysis.
* Separating processing pipelines for different application functions.
* Performing inference using TensorFlow Lite.

Actual performance depends on the device, camera configuration, model, and available hardware acceleration.

## Limitations

* Depth estimation provides **relative depth**, not guaranteed physical distance.
* Detection accuracy depends on lighting, camera quality, object visibility, and model performance.
* Real-time performance varies between mobile devices.
* The current application is primarily developed and tested on Android hardware.

## Privacy

The core perception pipeline is designed to process camera and audio data locally on the device. No cloud-based inference service is required for the main recognition functions.

Users should still review the permissions requested by the application before use.

## References & Attributions

The project uses and builds upon several open-source technologies and research works:

1. [Ultralytics YOLO26](https://docs.ultralytics.com/models/yolo26/) — object detection.
2. [MiDaS](https://github.com/isl-org/MiDaS) — monocular depth estimation.
3. [TensorFlow Lite](https://www.tensorflow.org/lite) — on-device machine learning inference.
4. [OpenCV](https://opencv.org/) — image processing.
5. [Google ML Kit](https://developers.google.com/ml-kit) — text recognition.
6. [Vosk](https://alphacephei.com/vosk/) — speech recognition.
7. [VisionCamera](https://react-native-vision-camera.com/) — camera frame acquisition.
8. [React Native](https://reactnative.dev/) — mobile application framework.

Please refer to the official documentation and license terms of each dependency before redistributing the application or its models.

## License

The project does not currently declare a standalone open-source license.

This is intentional because the repository contains and depends on third-party models and libraries with their own licensing requirements. In particular, the licensing terms associated with Ultralytics YOLO models should be reviewed before selecting a license for the complete project.

Until a project-wide license is explicitly added, the repository should not be assumed to be available for unrestricted reuse, modification, or redistribution.

## Author

**Duong Thieu Huy**

VissionAssistant is developed as a final-year thesis project focusing on AI-assisted real-time perception for visually impaired users.

---

**Repository:** [Yangshunhui716/VissionAssistant](https://github.com/Yangshunhui716/VissionAssistant)
