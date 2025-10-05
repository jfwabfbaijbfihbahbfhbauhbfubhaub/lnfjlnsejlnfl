// Konfigurasi untuk GitHub Pages
const MODEL_BASE_URL = './models/';

// Data siswa dengan gambar yang lebih reliable
let students = [
    {
        id: 1,
        name: "Ahmad Rizki",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
        present: false,
        faceDescriptor: null
    },
    {
        id: 2, 
        name: "Siti Nurhaliza",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
        present: false,
        faceDescriptor: null
    },
    {
        id: 3,
        name: "Budi Santoso", 
        avatar: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=150&h=150&fit=crop&crop=face",
        present: false,
        faceDescriptor: null
    }
];

// Variabel global
let stream = null;
let isCameraActive = false;
let isModelLoaded = false;
let autoScanInterval = null;
let labeledFaceDescriptors = null;
let faceMatcher = null;

// Elemen DOM
const cameraFeed = document.getElementById('cameraFeed');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const faceOverlay = document.getElementById('faceOverlay');
const scanningOverlay = document.getElementById('scanningOverlay');
const attendanceList = document.getElementById('attendanceList');
const presentCount = document.getElementById('presentCount');
const absentCount = document.getElementById('absentCount');
const totalCount = document.getElementById('totalCount');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const startCameraBtn = document.getElementById('startCamera');
const stopCameraBtn = document.getElementById('stopCamera');
const scanFacesBtn = document.getElementById('scanFaces');
const autoScanToggle = document.getElementById('autoScanToggle');
const trainModelBtn = document.getElementById('trainModel');
const loadSampleDataBtn = document.getElementById('loadSampleData');
const uploadPhotosBtn = document.getElementById('uploadPhotos');
const studentPhotoInput = document.getElementById('studentPhoto');
const modelStatus = document.getElementById('modelStatus');
const modelStatusText = document.getElementById('modelStatusText');
const loadingProgress = document.getElementById('loadingProgress');

// Inisialisasi
document.addEventListener('DOMContentLoaded', async function() {
    renderStudentList();
    updateStats();
    await initializeFaceAPI();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    startCameraBtn.addEventListener('click', startCamera);
    stopCameraBtn.addEventListener('click', stopCamera);
    scanFacesBtn.addEventListener('click', scanFaces);
    trainModelBtn.addEventListener('click', trainModel);
    loadSampleDataBtn.addEventListener('click', loadSampleData);
    uploadPhotosBtn.addEventListener('click', () => studentPhotoInput.click());
    studentPhotoInput.addEventListener('change', handlePhotoUpload);
    
    autoScanToggle.addEventListener('change', function() {
        if (this.checked && isCameraActive) {
            startAutoScan();
            showNotification("Scan otomatis diaktifkan", "success");
        } else {
            stopAutoScan();
            showNotification("Scan otomatis dimatikan", "warning");
        }
    });
}

// Initialize FaceAPI dengan error handling yang lebih baik
async function initializeFaceAPI() {
    try {
        updateModelStatus('loading', 'Memuat model AI...');
        
        console.log('Memulai loading model dari:', MODEL_BASE_URL);
        
        // Load model dengan error handling individual
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL);
            console.log('Tiny Face Detector loaded');
            loadingProgress.style.width = '25%';
        } catch (e) {
            console.error('Error loading Tiny Face Detector:', e);
            throw new Error('Gagal memuat Tiny Face Detector');
        }
        
        try {
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE_URL);
            console.log('Face Landmark loaded');
            loadingProgress.style.width = '50%';
        } catch (e) {
            console.error('Error loading Face Landmark:', e);
            throw new Error('Gagal memuat Face Landmark');
        }
        
        try {
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE_URL);
            console.log('Face Recognition loaded');
            loadingProgress.style.width = '75%';
        } catch (e) {
            console.error('Error loading Face Recognition:', e);
            throw new Error('Gagal memuat Face Recognition');
        }
        
        // Face Expression optional, tidak critical
        try {
            await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_BASE_URL);
            console.log('Face Expression loaded');
        } catch (e) {
            console.warn('Face Expression model gagal dimuat, lanjut tanpa ekspresi:', e);
        }
        
        loadingProgress.style.width = '100%';
        isModelLoaded = true;
        updateModelStatus('ready', 'Model AI siap digunakan!');
        showNotification("Semua model AI berhasil dimuat", "success");
        
    } catch (error) {
        console.error("Error loading models:", error);
        updateModelStatus('error', 'Gagal memuat model AI');
        showNotification("Error: " + error.message, "error");
        
        // Fallback: coba load dari CDN
        await tryLoadFromCDN();
    }
}

// Fallback ke CDN jika local model gagal
async function tryLoadFromCDN() {
    try {
        updateModelStatus('loading', 'Mencoba load dari CDN...');
        const CDN_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/';
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL);
        
        isModelLoaded = true;
        updateModelStatus('ready', 'Model AI siap digunakan (CDN)');
        showNotification("Model berhasil dimuat dari CDN", "success");
        
    } catch (cdnError) {
        console.error("Juga gagal load dari CDN:", cdnError);
        updateModelStatus('error', 'Model AI tidak tersedia');
        showNotification("Gagal memuat model AI dari semua sumber", "error");
    }
}

// Update status model
function updateModelStatus(status, message) {
    modelStatus.className = 'model-status';
    const indicator = modelStatus.querySelector('.status-indicator');
    indicator.className = 'status-indicator ' + status;
    modelStatusText.textContent = message;
}

// Render daftar siswa - DIPERBAIKI
function renderStudentList() {
    attendanceList.innerHTML = '';
    students.forEach(student => {
        const studentItem = document.createElement('div');
        studentItem.className = 'student-item';
        
        const statusClass = student.present ? 'status-present' : 'status-absent';
        const statusText = student.present ? 'Hadir' : 'Belum Hadir';
        const statusIcon = student.present ? 'fa-check-circle' : 'fa-clock';
        const trainedIcon = student.faceDescriptor ? 'fa-check text-success' : 'fa-times text-danger';
        
        studentItem.innerHTML = `
            <img src="${student.avatar}" alt="${student.name}" class="student-avatar"
                 onerror="this.src='https://via.placeholder.com/150/667eea/ffffff?text=${student.name.charAt(0)}'">
            <div class="student-info">
                <div class="student-name">${student.name}</div>
                <div class="student-id">ID: ${student.id}</div>
                <div class="attendance-status ${statusClass}">
                    <i class="fas ${statusIcon}"></i> ${statusText}
                </div>
            </div>
            <div>
                <i class="fas ${trainedIcon}" title="${student.faceDescriptor ? 'Telah dilatih' : 'Belum dilatih'}"></i>
            </div>
        `;
        
        attendanceList.appendChild(studentItem);
    });
}

// Update statistik
function updateStats() {
    const present = students.filter(s => s.present).length;
    const absent = students.length - present;
    
    presentCount.textContent = present;
    absentCount.textContent = absent;
    totalCount.textContent = students.length;
}

// Train model - DIPERBAIKI dengan error handling
async function trainModel() {
    if (!isModelLoaded) {
        showNotification("Model AI belum siap. Tunggu hingga loading selesai.", "error");
        return;
    }
    
    showNotification("Memulai training model...", "success");
    trainModelBtn.disabled = true;
    trainModelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Training...';
    
    try {
        const labeledDescriptors = [];
        let trainedCount = 0;
        let failedCount = 0;
        
        // Clear previous descriptors
        students.forEach(student => {
            student.faceDescriptor = null;
        });
        
        for (const student of students) {
            try {
                console.log(`Training untuk: ${student.name}`);
                
                // Create new image element
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                // Wait for image to load
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => reject(new Error(`Gagal load gambar: ${student.name}`));
                    img.src = student.avatar + '?t=' + Date.now(); // Cache bust
                });
                
                console.log(`Gambar loaded: ${student.name}`);
                
                // Detect face dengan timeout
                const detection = await Promise.race([
                    faceapi
                        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptor(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout detection')), 10000)
                    )
                ]);
                
                if (detection) {
                    student.faceDescriptor = detection.descriptor;
                    labeledDescriptors.push(
                        new faceapi.LabeledFaceDescriptors(
                            student.name, 
                            [detection.descriptor]
                        )
                    );
                    trainedCount++;
                    console.log(`✅ Berhasil train: ${student.name}`);
                    showNotification(`✅ ${student.name} berhasil dilatih`, "success");
                } else {
                    failedCount++;
                    console.warn(`❌ Tidak detect wajah: ${student.name}`);
                    showNotification(`❌ Tidak detect wajah di ${student.name}`, "warning");
                }
                
            } catch (studentError) {
                failedCount++;
                console.error(`Error training ${student.name}:`, studentError);
                showNotification(`❌ Error training ${student.name}`, "error");
            }
            
            // Small delay antara siswa
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (labeledDescriptors.length > 0) {
            labeledFaceDescriptors = labeledDescriptors;
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
            
            const message = `🎉 Model trained: ${trainedCount} berhasil, ${failedCount} gagal`;
            showNotification(message, "success");
            console.log('Training completed:', { trainedCount, failedCount });
            
        } else {
            showNotification("❌ Tidak ada wajah yang berhasil dilatih", "error");
        }
        
        renderStudentList();
        
    } catch (error) {
        console.error("Error dalam proses training:", error);
        showNotification("❌ Gagal training model: " + error.message, "error");
    } finally {
        trainModelBtn.disabled = false;
        trainModelBtn.innerHTML = '<i class="fas fa-brain"></i> Train Model';
    }
}

// Fungsi-fungsi lainnya tetap sama...
// [Keep all the other functions from the previous version: startCamera, stopCamera, detectFaces, etc.]

// Mulai kamera
async function startCamera() {
    try {
        if (!isModelLoaded) {
            showNotification("Model AI belum siap", "error");
            return;
        }
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        
        cameraFeed.srcObject = stream;
        cameraFeed.style.display = 'block';
        cameraPlaceholder.style.display = 'none';
        
        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        scanFacesBtn.disabled = !faceMatcher;
        
        isCameraActive = true;
        showNotification("Kamera berhasil diaktifkan", "success");
        
        if (autoScanToggle.checked) {
            startAutoScan();
        }
        
    } catch (error) {
        console.error("Error accessing camera:", error);
        showNotification("Gagal mengakses kamera: " + error.message, "error");
    }
}

// Hentikan kamera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    stopAutoScan();
    
    cameraFeed.style.display = 'none';
    cameraPlaceholder.style.display = 'flex';
    scanningOverlay.style.display = 'none';
    faceOverlay.innerHTML = '';
    
    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
    scanFacesBtn.disabled = true;
    
    isCameraActive = false;
    showNotification("Kamera dimatikan", "warning");
}

// Deteksi wajah
async function detectFaces() {
    if (!isCameraActive || !isModelLoaded) return;
    
    try {
        const detections = await faceapi
            .detectAllFaces(cameraFeed, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        faceOverlay.innerHTML = '';
        
        if (detections.length > 0 && faceMatcher) {
            detections.forEach(detection => {
                const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                
                const box = detection.detection.box;
                const drawBox = new faceapi.draw.DrawBox(box, { 
                    label: bestMatch.toString(),
                    boxColor: bestMatch.distance < 0.6 ? 'green' : 'red'
                });
                drawBox.draw(faceOverlay);
                
                if (bestMatch.distance < 0.6) {
                    const studentName = bestMatch.label.replace(/ \d+$/, '');
                    markAttendance(studentName);
                }
            });
        } else if (detections.length > 0) {
            detections.forEach(detection => {
                const box = detection.detection.box;
                const drawBox = new faceapi.draw.DrawBox(box, { 
                    label: 'Wajah Terdeteksi'
                });
                drawBox.draw(faceOverlay);
            });
        }
        
    } catch (error) {
        console.error("Error detecting faces:", error);
    }
}

// Tandai kehadiran
function markAttendance(studentName) {
    const student = students.find(s => s.name === studentName);
    if (student && !student.present) {
        student.present = true;
        showNotification(`✅ ${studentName} telah hadir`, "success");
        renderStudentList();
        updateStats();
    }
}

// Scan wajah manual
async function scanFaces() {
    if (!isCameraActive) {
        showNotification("Aktifkan kamera terlebih dahulu", "error");
        return;
    }
    
    if (!faceMatcher) {
        showNotification("Model belum dilatih dengan data wajah", "error");
        return;
    }
    
    scanningOverlay.style.display = 'flex';
    showNotification("Memindai wajah...", "success");
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await detectFaces();
    
    scanningOverlay.style.display = 'none';
}

// Auto scan
function startAutoScan() {
    if (autoScanInterval) clearInterval(autoScanInterval);
    autoScanInterval = setInterval(detectFaces, 2000);
}

function stopAutoScan() {
    if (autoScanInterval) {
        clearInterval(autoScanInterval);
        autoScanInterval = null;
    }
}

// Load sample data
async function loadSampleData() {
    showNotification("Memuat data sample...", "success");
    
    // Reset semua kehadiran
    students.forEach(student => {
        student.present = false;
    });
    
    // Acak beberapa siswa sebagai hadir
    const randomIndex = Math.floor(Math.random() * students.length);
    students[randomIndex].present = true;
    
    renderStudentList();
    updateStats();
    showNotification("Data sample berhasil dimuat", "success");
}

// Handle photo upload
function handlePhotoUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    showNotification(`Mengupload ${files.length} foto...`, "success");
    
    // Simulasi processing upload
    setTimeout(() => {
        showNotification(`${files.length} foto berhasil diupload`, "success");
        studentPhotoInput.value = '';
    }, 2000);
}

// Show notification
function showNotification(message, type = 'success') {
    notificationText.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
