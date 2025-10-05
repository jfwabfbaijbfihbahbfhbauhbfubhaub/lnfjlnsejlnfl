// Konfigurasi untuk GitHub Pages
const MODEL_BASE_URL = './models/';
const SAMPLE_STUDENTS_URL = './students/';

// Data siswa
let students = [
    {
        id: 1,
        name: "Ahmad Rizki",
        avatar: "https://randomuser.me/api/portraits/men/32.jpg",
        present: false,
        faceDescriptor: null
    },
    {
        id: 2, 
        name: "Siti Nurhaliza",
        avatar: "https://randomuser.me/api/portraits/women/44.jpg",
        present: false,
        faceDescriptor: null
    },
    {
        id: 3,
        name: "Budi Santoso", 
        avatar: "https://randomuser.me/api/portraits/men/22.jpg",
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

// Initialize FaceAPI
async function initializeFaceAPI() {
    try {
        updateModelStatus('loading', 'Memuat model AI dari GitHub...');
        
        // Load model dari folder local
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL);
        loadingProgress.style.width = '25%';
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE_URL);
        loadingProgress.style.width = '50%';
        
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE_URL);
        loadingProgress.style.width = '75%';
        
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_BASE_URL);
        loadingProgress.style.width = '100%';
        
        isModelLoaded = true;
        updateModelStatus('ready', 'Model AI siap digunakan!');
        showNotification("Semua model AI berhasil dimuat dari repository", "success");
        
    } catch (error) {
        console.error("Error loading models:", error);
        updateModelStatus('error', 'Gagal memuat model AI');
        showNotification("Gagal memuat model. Pastikan folder 'models' tersedia.", "error");
    }
}

// Update status model
function updateModelStatus(status, message) {
    modelStatus.className = 'model-status';
    const indicator = modelStatus.querySelector('.status-indicator');
    indicator.className = 'status-indicator ' + status;
    modelStatusText.textContent = message;
}

// Render daftar siswa
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
            <img src="${student.avatar}" alt="${student.name}" class="student-avatar">
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
        scanFacesBtn.disabled = false;
        
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

// Train model
async function trainModel() {
    if (!isModelLoaded) {
        showNotification("Model AI belum siap", "error");
        return;
    }
    
    showNotification("Melatih model dengan data wajah...", "success");
    scanningOverlay.style.display = 'flex';
    
    try {
        const labeledDescriptors = [];
        let trainedCount = 0;
        
        for (const student of students) {
            const img = await faceapi.fetchImage(student.avatar);
            const detection = await faceapi
                .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();
            
            if (detection) {
                student.faceDescriptor = detection.descriptor;
                labeledDescriptors.push(
                    new faceapi.LabeledFaceDescriptors(
                        student.name, 
                        [detection.descriptor]
                    )
                );
                trainedCount++;
                showNotification(`✅ Wajah ${student.name} berhasil dipelajari`, "success");
            } else {
                showNotification(`❌ Tidak dapat mendeteksi wajah ${student.name}`, "error");
            }
        }
        
        if (labeledDescriptors.length > 0) {
            labeledFaceDescriptors = labeledDescriptors;
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
            showNotification(`🎉 Model berhasil dilatih dengan ${trainedCount} siswa`, "success");
        } else {
            showNotification("❌ Tidak ada wajah yang berhasil dipelajari", "error");
        }
        
        renderStudentList();
        
    } catch (error) {
        console.error("Error training model:", error);
        showNotification("❌ Gagal melatih model", "error");
    } finally {
        scanningOverlay.style.display = 'none';
    }
}

// Load sample data
async function loadSampleData() {
    showNotification("Memuat data sample...", "success");
    
    // Simulasi loading data sample
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    students.forEach(student => {
        student.present = Math.random() > 0.5;
    });
    
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
