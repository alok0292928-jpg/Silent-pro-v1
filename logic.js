// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// --- CONFIGURATION: BHARAT STUDENT PLATFORM ---
const firebaseConfig = {
    apiKey: "AIzaSyDmToqWOaBjODzAauhpxriCg-imiAKg-aQ",
    authDomain: "bharat-student-platform.firebaseapp.com",
    databaseURL: "https://bharat-student-platform-default-rtdb.firebaseio.com",
    projectId: "bharat-student-platform",
    storageBucket: "bharat-student-platform.firebasestorage.app",
    messagingSenderId: "390311052094",
    appId: "1:390311052094:web:93234b2311c1a44a87226f",
    measurementId: "G-NDBKSP54N4"
};

// --- INITIALIZE DB ---
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("DB Connected");
} catch (e) {
    console.log("Offline Mode");
}

// --- STATE ---
let logicHistory = []; // Synced with UI

// --- EXPORTED FUNCTIONS (Available to index.html) ---

// 1. DATA SYNC
window.updateLogicData = function(data) {
    logicHistory = data;
};

// 2. LOGIN LOGIC
window.secureLogin = async function(keyVal) {
    const spinner = document.getElementById('loadingSpinner');
    const err = document.getElementById('error-msg');
    
    spinner.style.display = 'block';
    err.style.display = 'none';

    // MASTER KEY BYPASS
    if (keyVal === "Goku999") {
        setTimeout(() => { window.unlockUI("ADMIN (MASTER)"); }, 800);
        return;
    }

    // DB CHECK
    if (!db) {
        setTimeout(() => {
            spinner.style.display = 'none';
            err.style.display = 'block';
            err.innerText = "Connection Failed. Use Goku999";
        }, 1500);
        return;
    }

    try {
        const q = query(collection(db, "access_keys"), where("key_code", "==", keyVal.trim()));
        const snap = await getDocs(q);
        
        if (snap.empty) throw new Error("Invalid Key");
        
        let data = null; snap.forEach(d => data = d.data());
        if (data.status === 'banned') throw new Error("ID Blocked");
        
        const now = new Date();
        const expiry = new Date(data.expires_at);
        if (now > expiry) throw new Error("Key Expired");

        window.unlockUI(data.owner);

    } catch (e) {
        spinner.style.display = 'none';
        err.style.display = 'block';
        err.innerText = e.message;
    }
};

// 3. AI PREDICTION LOGIC
window.runAnalysis = async function() {
    const btn = document.getElementById('genBtn');
    
    if (logicHistory.length < 5) { alert("Need 5+ Results"); return; }
    if (typeof tf === 'undefined') { alert("AI Loading..."); return; }

    btn.innerHTML = "⏳ CALCULATING...";
    
    try {
        // Prepare Data
        const rawValues = logicHistory.map(d => d.type === 'BIG' ? 1 : 0);
        const xs = []; const ys = [];
        
        for(let i=0; i < rawValues.length - 1; i++) {
            xs.push([[rawValues[i]]]);
            ys.push([rawValues[i+1]]);
        }

        // Tensor
        const xTensor = tf.tensor3d(xs, [xs.length, 1, 1]);
        const yTensor = tf.tensor2d(ys, [ys.length, 1]);

        // Model
        const model = tf.sequential();
        model.add(tf.layers.lstm({ units: 16, inputShape: [1, 1] }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        model.compile({ optimizer: 'adam', loss: 'binaryCrossentropy' });

        // Train (Silent)
        await model.fit(xTensor, yTensor, { epochs: 30, verbose: 0 });

        // Predict
        const lastVal = rawValues[rawValues.length - 1];
        const input = tf.tensor3d([[[lastVal]]], [1, 1, 1]);
        const output = model.predict(input);
        const prob = output.dataSync()[0];

        // Cleanup
        xTensor.dispose(); yTensor.dispose(); input.dispose(); output.dispose();

        // Result
        let prediction = prob > 0.5 ? "BIG" : "SMALL";
        let confidence = Math.floor(Math.abs(prob - 0.5) * 200);
        if(confidence < 60) confidence += 15; 
        if(confidence > 98) confidence = 98;

        btn.innerHTML = "⚡ PREDICT NEXT";
        window.showResultUI(prediction, confidence);

    } catch (e) {
        console.error(e);
        btn.innerHTML = "ERROR";
    }
};

// 4. OCR LOGIC
window.processImage = function(input) {
    if (input.files && input.files[0]) {
        document.getElementById('ocr-status').style.display = 'block';
        
        Tesseract.recognize(input.files[0], 'eng').then(({ data: { text } }) => {
            let extracted = []; 
            let lines = text.split('\n');
            
            lines.forEach(line => { 
                if (/Big|Small|Green|Red/i.test(line)) { 
                    let m = line.match(/\b([0-9])\b/); 
                    if(m) extracted.push(parseInt(m[1])); 
                } 
            });
            
            if (extracted.length === 0) { 
                let m = text.match(/\b\d\b/g); 
                if(m) extracted = m.map(d=>parseInt(d)); 
            }

            if (extracted.length > 0) { 
                // Auto-fill logic history
                let newHist = [];
                extracted.slice(0, 15).reverse().forEach(n => {
                    newHist.push({ num: n, type: n>=5?'BIG':'SMALL' });
                });
                
                // Update UI and Logic
                window.uiHistory = newHist;
                window.updateLogicData(newHist);
                
                // Manually trigger render in UI via a helper if needed, 
                // or just alert user to refresh visual. 
                // Better: Direct DOM Manipulation from here since we split files
                const container = document.getElementById('history-row');
                container.innerHTML = '';
                newHist.forEach(h => {
                    let colorClass = '';
                    if(h.num===0) colorClass='bg-g-violet-red';
                    else if(h.num===5) colorClass='bg-g-violet-green';
                    else if([1,3,7,9].includes(h.num)) colorClass='bg-g-green';
                    else colorClass='bg-g-red';
                    const ball = document.createElement('div');
                    ball.className = `min-w-[35px] h-[35px] rounded-full flex items-center justify-center font-bold text-white border border-white/20 ${colorClass}`;
                    ball.innerText = h.num;
                    container.appendChild(ball);
                });

                alert("Scan Complete!");
            } else { 
                alert("Scan Failed. Try Manual."); 
            }
            document.getElementById('ocr-status').style.display = 'none';
        });
    }
};
