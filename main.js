let video = document.getElementById("qr-video");
let canvasElement = document.getElementById("qr-canvas");
let canvas = canvasElement.getContext("2d");
let qrResultElement = document.getElementById("qr-result");
let startXRButton = document.getElementById("start-xr");

let qrCodeData = null; // Holds QR code data after detection
let hasLocalized = false; // Whether QR code localization has happened

// Initialize camera and start scanning for QR codes
function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
    video.srcObject = stream;
    video.setAttribute("playsinline", true); // Required to make video work in iOS
    video.play();
    tick();
    });

    function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.height = video.videoHeight;
        canvasElement.width = video.videoWidth;
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        let imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

        if (code) {
        qrCodeData = code.data;
        qrResultElement.innerText = `QR Code detected: ${qrCodeData}`;
        hasLocalized = true;

        stopCamera(); // Stop custom QR scanning camera feed
        startAR();    // Transition to WebXR AR session
        } else {
        qrResultElement.innerText = "No QR code detected.";
        }
    }

    if (!hasLocalized) {
        requestAnimationFrame(tick);
    }
    }
}

function stopCamera() {
    let stream = video.srcObject;
    let tracks = stream.getTracks();
    tracks.forEach(track => track.stop()); // Stop the camera feed
}

// Initialize WebXR after localization
async function startAR() {
    if (!hasLocalized) {
      alert("You must scan the QR code first.");
      return;
    }
  
  // Start the AR session using WebXR
    if (navigator.xr && navigator.xr.isSessionSupported) {
        const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local-floor"],  // Use local-floor or viewer reference space
        optionalFeatures: ["hit-test"]      // For placing virtual objects based on environment
        });
        onXRSessionStart(session);
    } else {
        alert("WebXR is not supported on this device.");
    }
  }

  function onXRSessionStart(session) {
    // Initialize the Three.js renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.xr.enabled = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create a basic Three.js scene
    scene = new THREE.Scene();

    // Add virtual objects to the AR scene
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, -1); // Position the cube 1 meter in front of the user
    scene.add(cube);

    session.requestReferenceSpace('local-floor').then((refSpace) => {
      // Use the reference space to render the scene
      session.requestAnimationFrame(function onXRFrame(time, frame) {
        // Get the XR frame and render the scene
        const pose = frame.getViewerPose(refSpace);
        if (pose) {
          for (const view of pose.views) {
            // Set the camera based on the XR view
            camera.projectionMatrix.fromArray(view.projectionMatrix);
            camera.matrix.fromArray(view.transform.matrix);
            camera.matrix.decompose(camera.position, camera.rotation, camera.scale);
            
            // Render the scene for each view
            renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            renderer.render(scene, camera);
          }
        }
        session.requestAnimationFrame(onXRFrame);  // Continue rendering frames
      });
    }).catch((error) => {
      console.error("Error setting reference space:", error);
    });
  }

startCamera();
startXRButton.addEventListener("click", startAR);