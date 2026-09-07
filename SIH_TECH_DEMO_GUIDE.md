# 🛰️ OceanGuard — SIH Grand Finale Live Tech Demo & Defense Q&A Guide

> **Presentation Context**: 
> - **Format**: Team Tech Demo (Teammate presents Problem Statement ➔ Hands over to **You** for the Live Platform Walkthrough).
> - **Your Live Demo Duration**: 75 to 90 seconds (Leaves generous buffer for judges' questions).
> - **Platform URL**: `http://localhost:3000/` (Full-Screen Browser).

---

## 🎬 Part 1: Your 90-Second Live Tech Demo Script

### 🔄 The Handover Hook (0:00 – 0:12)
*(Screen is in full screen showing `http://localhost:3000/` with the dark tactical bathymetry map active)*

> **Teammate concludes**:  
> *"...and that is why nocturnal bilge dumping goes unpunished. Now, my teammate will walk you through OceanGuard running live."*

**Your Voice (Confident, crisp, operational tone):**  
> **"Thank you. Judges, what you see on screen is OceanGuard's live tactical command center, actively streaming C-Band Synthetic Aperture Radar and real-time maritime AIS telemetry.**
> 
> **Let me demonstrate how we detect an illegal discharge and forensic-lock the culprit in under 5 seconds."**

---

### 🛰️ Act 1: 24/7 SAR Radar AI & Marangoni Physics (0:12 – 0:38)
*(Action: Click **`SAR Analysis`** in the top navigation bar to bring up the inspection modal)*

> **"Optical cameras fail in dark and overcast conditions. OceanGuard processes raw European Space Agency Sentinel-1 C-Band radar, penetrating clouds and total darkness 24/7.**
> 
> **Our deep-learning DeepSAR U-Net segments the slick boundary with 94.2% accuracy.**
> 
> **Crucially, we eliminate false-positive look-alikes—the bane of satellite surveillance. Using Marangoni wave damping physics, our Bayesian classifier proves that under current 12.8-knot winds, surface capillary waves are suppressed by 8.9 dB. That confirms mineral petroleum with 98.2% likelihood, mathematically ruling out algal blooms, natural grease films, or calm water."**

---

### ⏪ Act 2: -6h Hydrodynamic Hindcast & AIS Blackout Tracking (0:38 – 1:08)
*(Action: Close modal or point to map; point to the **amber -6h hindcast cone**, then smoothly scrub the **Timeline Slider** backward to $T-42\text{m}$)*

> **"Detecting a slick is only half the battle—we must prove *who* dumped it.**
> 
> **1. -6h Hydrodynamic Hindcast:** Combining ocean currents and wind leeway drift, our reverse Fay advection engine back-traces the spill across 6 hours, pinpointing the exact release origin at $T-42$ minutes.
> 
> **2. Forensic AIS Dark Tracking:** Look at the fleet—while 8 commercial cargo ships maintained steady course, suspect vessel **`MEDITERRANEAN TRADER`** abruptly decelerated from 13.5 to 5.4 knots and **deliberately killed its AIS transponder** directly over the discharge coordinate.
> 
> **Our kinematic correlation engine flags this with a 98.4% anomaly score, automatically locking the tactical radar reticle on the vessel."**

---

### 🛡️ Act 3: Ecological Threat Matrix & Instant PDF Audit (1:08 – 1:28)
*(Action: Click the **`Legend`** tab in the top-left drawer to show dynamic monitored assets, then click **`PDF Audit`** in the top bar)*

> **"OceanGuard continuously assesses vulnerable blue-economy assets—including active pelagic fishing fairways and offshore mariculture cages.**
> 
> **Finally, with one click of 'PDF Audit', OceanGuard compiles an admissible forensic dossier—complete with cryptographic satellite timestamps, geodesic CPA proof, and AIS transponder gap logs ready for prosecution under MARPOL Annex I.**
> 
> **OceanGuard bridges the gap between satellite remote sensing and immediate maritime law enforcement. We are ready for your questions!"**

---

## 📋 Part 2: Visual Click Flow Cheatsheet

| Time | What You Say | Physical Mouse Action | Visual Output on Screen |
|:---|:---|:---|:---|
| **0:00 - 0:12** | Handover hook & live command center intro | Smooth mouse circle over the tactical map | Full dark tactical map with live vessel trails & incident banner |
| **0:12 - 0:38** | SAR radar, U-Net, Marangoni 8.9 dB physics | Click **`SAR Analysis`** button (top bar) | Modal displays U-Net binary mask, 6-class Bayesian radar probability breakdown |
| **0:38 - 0:52** | -6h reverse hydrodynamic drift back-tracing | Close modal, point mouse at **amber cone** | Map highlights -6h hindcast back-tracing origin |
| **0:52 - 1:08** | AIS transponder blackout & deceleration | Drag **Timeline scrubber** backward to **$T-42\text{m}$** | `MEDITERRANEAN TRADER` glows crimson with tactical reticle brackets locking over breach point |
| **1:08 - 1:18** | Ecological zones & dynamic monitored fleet | Click **`Tactical Layers & Legend`** ➔ **`Legend`** tab | Dynamic legend shows: Culprit 98% Match, Patrol unit, 8 Monitored cargo ships, 0.37 km² slick |
| **1:18 - 1:28** | Admissible legal dossier & wrap-up | Click **`PDF Audit`** button (cyan button in top bar) | Instant download of multi-page forensic audit report |

---

## 🧠 Part 3: Exhaustive Judges Q&A Bank (Classified by Domain)

### Category A: Satellite & Machine Learning (SAR, Computer Vision, Physics)

#### Q1: "Why use SAR instead of high-resolution Optical imagery (Sentinel-2, PlanetScope, WorldView)?"
> **Answer:**
> "Optical satellites require daylight and cloudless skies. However, over 75% of illegal bilge and tank washings occur under cover of night, and tropical coasts (like India's coastline during monsoon) suffer from persistent 80%+ cloud cover. Sentinel-1 SAR uses 5.405 GHz C-band microwave radar that penetrates clouds, monsoon rains, and darkness 24/7. SAR is the only satellite sensor viable for non-stop operational surveillance."

#### Q2: "SAR dark patches are notoriously ambiguous. How do you distinguish oil slicks from natural look-alikes (algal blooms, biogenic slicks, low-wind calm water, ship wakes)?"
> **Answer:**
> "We combine **Deep Learning** with **Physical Wave Mechanics**:
> 1. **Spatial U-Net**: Evaluates morphological curvature, aspect ratio, edge gradients, and perimeter-to-area compactness.
> 2. **Marangoni Wave Damping Physics**: Mineral oil possesses high surface viscoelasticity that suppresses 3.7 cm Bragg capillary-gravity waves. We check surface winds from Copernicus/ECMWF: if winds are within the 3.0 to 12.0 m/s Bragg resonant window, mineral oil produces a damping contrast $> 5.5\text{ dB}$ (our incident measures **8.9 dB**).
> 3. **Bayesian 6-Class Softmax**: Dynamically evaluates physical logits for Oil, Calm Water, Natural Biogenic Film, Wake, Rain Artifact, and Epistemic Uncertainty—giving an explicit **98.2% mineral oil confidence**."

#### Q3: "What model architecture did you use, and how did you train it?"
> **Answer:**
> "We deployed a **DeepSAR U-Net** featuring an EfficientNet/ResNet feature encoder, trained on the **DARTIS benchmark dataset** across 15 ground-truth SAR scenes under varying wind conditions. The model achieves a **Dice Score of 0.713** and **IoU of 0.554**, running PyTorch/ONNX inference in under **120 milliseconds** per radar patch."

---

### Category B: Oceanography, Hydrodynamics & Drift Modeling

#### Q4: "How does your -6h Hindcast engine back-trace the oil spill origin?"
> **Answer:**
> "We implement an Eulerian-Lagrangian trajectory advection model:
> $$\vec{U}_{\text{drift}} = \vec{U}_{\text{current}} + \alpha \cdot \vec{U}_{\text{wind}}$$
> - $\vec{U}_{\text{current}}$ is the net ocean surface current vector from Copernicus Marine Service.
> - $\alpha \approx 0.03$ (wind leeway factor: oil moves at ~3% of surface wind velocity at 10m height with a 15° Coriolis deflection).
> To locate where the oil was spilled hours earlier, we reverse the vector $(\vec{U}_{\text{hindcast}} = -\vec{U}_{\text{drift}})$ across step-by-step timesteps with an expanding turbulent dispersion cone to account for horizontal eddy diffusivity."

#### Q5: "Does your platform account for weathering, evaporation, and spreading over time?"
> **Answer:**
> "Yes. We integrate **Fay’s three-regime hydrodynamic spreading theory** (gravity-inertia, gravity-viscous, and surface-tension-viscous spreading) combined with Mackay's evaporative weathering formulation. Based on water temperature and wind speed, the platform models volatile fraction evaporation (typically 25–35% volume loss in the first 24 hours) and calculates dynamic slick perimeter expansion."

---

### Category C: AIS Tracking, Forensic Attribution & Legal Admissibility

#### Q6: "If a rogue vessel turns off its AIS transponder ('goes dark'), how can you possibly identify it?"
> **Answer:**
> "That is the core innovation of our forensic pipeline:
> 1. Our hindcast engine pinpoints the **geodesic coordinates and time window of release** ($T-42$ minutes).
> 2. We analyze historical AIS records of all vessels operating in the transit corridor.
> 3. When a vessel disables its transponder, it creates a detectable anomaly: a sudden broadcast termination followed by reappearance miles away.
> 4. We compute the **Closest Point of Approach (CPA)** using dead-reckoning kinematics. If a vessel's trajectory directly intersects the breach coordinates at the exact timestamp and shows simultaneous engine deceleration (e.g. slowing from 13.5 to 5.4 knots for pumping), our algorithm flags it with a high-confidence attribution score."

#### Q7: "How is the suspect anomaly score calculated?"
> **Answer:**
> "It uses a multi-factor weighted forensic scoring formulation:
> - **CPA Distance (35%)**: Geodesic proximity of the vessel's track to the discharge centroid.
> - **AIS Blackout Gap (25%)**: Duration and timing of transponder shutoff relative to the spill.
> - **Speed Anomaly (20%)**: Deceleration below cruising speed required for bilge washing.
> - **Vessel & Cargo Multiplier (20%)**: Higher prior risk weighting for crude tankers and VLCCs versus passenger ferries."

#### Q8: "Can this evidence hold up in court or before international bodies like ITLOS or IMO?"
> **Answer:**
> "Yes. Our **PDF Audit Report** is structured according to **MARPOL Annex I** and ISO/IEC digital evidence standards. It documents:
> - Raw ESA Sentinel-1 scene product IDs and cryptographic hashes.
> - Exact timestamped AIS coordinates, MMSI, IMO registry, and flag state.
> - Mathematical CPA proof and metocean environmental parameters.
> This gives maritime enforcement agencies the evidentiary chain of custody needed to issue port-state detention orders or impose environmental fines."

---

### Category D: System Architecture, Scalability & National Deployment

#### Q9: "What is your software architecture, and how scalable is it?"
> **Answer:**
> - **Frontend**: React 18, TypeScript, Vite, TailwindCSS, MapLibre GL for 60fps GPU-accelerated vector rendering.
> - **Backend**: Asynchronous Python 3.11 FastAPI microservices, PyTorch for model inference, PostGIS/Supabase for spatial indexing.
> - **Performance**: Stateless, containerized in Docker. A single cluster node can ingest Sentinel-1 radar scenes, evaluate thousands of vessel tracks, and compute spatial CPA vectors in under 3 seconds using spatial R-Tree indexing."

#### Q10: "How can OceanGuard be integrated into the Indian Coast Guard (ICG) or ISRO ecosystem?"
> **Answer:**
> "OceanGuard is built for zero-friction integration:
> 1. **Data Ingestion**: Directly connects to **ISRO’s Bhuvan / MOSDAC** portal for Sentinel-1 and RISAT/EOS-04 radar data, and the **National Command Control Communication and Intelligence Network (NC3I)** for coastal AIS feeds.
> 2. **Operational Dispatch**: REST Webhook alerts dispatch immediately to the **Maritime Rescue Coordination Centre (MRCC)** and ICG interceptor boats with optimal intercept bearings."

---

## 🏆 Key Metrics to Memorize

| Metric | Exact Value | What it Proves |
|:---|:---|:---|
| **Segmentation Dice Score** | **0.7130 (71.3%)** | U-Net ground-truth boundary accuracy |
| **Marangoni Damping** | **8.9 dB** | Rules out biogenic look-alikes ($> 5.5\text{ dB}$ threshold) |
| **Oil Probability** | **98.2%** | Bayesian petroleum classification confidence |
| **Inference Latency** | **< 120 ms** | Real-time edge processing speed |
| **Discharge Origin** | **T - 42 minutes** | Reconstructed illicit dumping event |
| **Culprit Speed Drop** | **13.5 ➔ 5.4 knots** | Mechanical indicator of bilge pumping |
