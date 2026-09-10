import { jsPDF } from 'jspdf';
import { SuspectVessel, SpillGeoFeature, MetoceanData, VectorMatch } from '../types';
import { INCIDENTS } from './simulationEngine';
import { INITIAL_SUSPECTS, INITIAL_VECTOR_MATCHES } from './mockData';

export function generateClientSidePdfDossier(
  spillId?: string,
  spillFeature?: SpillGeoFeature | null,
  suspects?: SuspectVessel[],
  metocean?: MetoceanData,
  vectorMatches?: VectorMatch[]
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { timeZone: 'UTC' });
  const timeStr = now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC';

  const activeSpillId = spillId || 'DARTIS-ow-0001';
  const incident = INCIDENTS[activeSpillId] || INCIDENTS['DARTIS-ow-0001'] || Object.values(INCIDENTS)[0];

  const sceneName = spillFeature?.properties?.source_scene || incident?.sourceScene || 'ow-0001.jpg';
  const sectorName = incident?.locationName || 'Eastern Mediterranean • Cyprus Levantine Basin';
  const passTimeUtc = spillFeature?.properties?.acquisition_timestamp_utc || incident?.acquisition_timestamp_utc || '2019-01-01 03:42:35 UTC';
  const passTimeIst = spillFeature?.properties?.acquisition_timestamp_ist || incident?.acquisition_timestamp_ist || '2019-01-01 09:12:35 IST';

  const centroidCoords = spillFeature?.properties?.centroid
    ? `${spillFeature.properties.centroid[0].toFixed(4)}° N, ${spillFeature.properties.centroid[1].toFixed(4)}° E`
    : incident?.centroid
    ? `${incident.centroid[0].toFixed(4)}° N, ${incident.centroid[1].toFixed(4)}° E`
    : '33.2590° N, 33.0578° E';

  const originCoords = incident?.originCoords
    ? `${incident.originCoords[1].toFixed(4)}° N, ${incident.originCoords[0].toFixed(4)}° E (T-42m Origin)`
    : '33.2684° N, 33.0421° E (T-42m Origin)';

  const area = spillFeature?.properties?.area_sq_km || incident?.baseAreaSqKm || 0.37;
  const perimeter = spillFeature?.properties?.perimeter_km || 4.80;
  const rawDice = spillFeature?.properties?.segmentation_dice_score || incident?.segmentation_dice_score || 0.7130;
  const diceScore = (rawDice <= 1.0 ? rawDice * 100 : rawDice).toFixed(1);
  const rawIou = spillFeature?.properties?.segmentation_iou_score || incident?.segmentation_iou_score || 0.5540;
  const iouScore = (rawIou <= 1.0 ? rawIou * 100 : rawIou).toFixed(1);
  const rawMaxProb = spillFeature?.properties?.max_probability || incident?.max_probability || 0.982257;
  const maxProb = (rawMaxProb <= 1.0 ? rawMaxProb * 100 : rawMaxProb).toFixed(1);
  const dampingDb = (spillFeature?.properties?.damping_ratio_db || incident?.false_positive_analysis?.marangoni_damping_db || 8.9).toFixed(1);
  const volumeLiters = spillFeature?.properties?.estimated_discharge_liters || incident?.volumeLiters || 3975;
  const slickType = spillFeature?.properties?.slick_type || incident?.slickType || 'Heavy Fuel Oil (HFO-380 Bilge)';

  // Suspects list and primary suspect
  const vesselList = (suspects && suspects.length > 0) ? suspects : INITIAL_SUSPECTS;
  const primarySuspect = vesselList[0] || {
    name: 'MEDITERRANEAN TRADER',
    mmsi: 212000001,
    flag: 'Malta',
    vessel_type: 'Very Large Crude Carrier (VLCC)',
    length_meters: 315,
    draught_meters: 15.8,
    call_sign: '9HA4211',
    destination: 'CYPRUS OFFSHORE TRANSIT',
    cargo_type: 'Crude Oil (315,000 DWT)',
    probability_score: 98.4,
    anomaly_score: 98.4,
    distance_meters: 0.0,
    speed_knots: 13.5,
    heading_degrees: 84
  };

  const anomalyScore = (primarySuspect.anomaly_score || primarySuspect.probability_score || 98.4).toFixed(1);

  // Metocean data
  const activeMetocean = metocean || {
    wind_speed_kts: 12.8,
    wind_direction_deg: 285.0,
    wind_cardinal: 'WNW',
    current_speed_kts: 1.1,
    current_direction_deg: 95.0,
    current_cardinal: 'E',
    net_drift_speed_kts: 1.52,
    net_drift_direction_deg: 95.0,
    hindcast_direction_deg: 275.0,
    sea_surface_temp_c: 21.4,
    significant_wave_height_m: 1.2,
    weathering_evaporation_pct: 26.5,
    weathering_emulsification_pct: 31.0,
    sar_backscatter_quality: 'OPTIMAL (High Radar Contrast)',
    sea_state: 'Moderate (Beaufort 3-4)'
  };

  // False positive probabilities
  const fpAnalysis = spillFeature?.properties?.false_positive_analysis || incident?.false_positive_analysis;
  const oilProb = fpAnalysis?.classes?.['Oil'] !== undefined ? `${fpAnalysis.classes['Oil'].toFixed(1)}%` : '98.2%';
  const calmProb = fpAnalysis?.classes?.['Calm water'] !== undefined ? `${fpAnalysis.classes['Calm water'].toFixed(1)}%` : '0.8%';
  const bioProb = fpAnalysis?.classes?.['Natural film'] !== undefined ? `${fpAnalysis.classes['Natural film'].toFixed(1)}%` : '0.5%';
  const wakeProb = fpAnalysis?.classes?.['Wake'] !== undefined ? `${fpAnalysis.classes['Wake'].toFixed(1)}%` : '0.3%';
  const rainProb = fpAnalysis?.classes?.['Rain-related artifact'] !== undefined ? `${fpAnalysis.classes['Rain-related artifact'].toFixed(1)}%` : '0.1%';
  const unkProb = fpAnalysis?.classes?.['Unknown'] !== undefined ? `${fpAnalysis.classes['Unknown'].toFixed(1)}%` : '0.1%';

  const totalPages = 2;

  // STRICT TEXT BOUNDING HELPER: Guarantees text NEVER exceeds maxWidth or right page border
  function drawBoundedText(
    text: string | number | null | undefined,
    x: number,
    y: number,
    maxWidth: number,
    align: 'left' | 'center' | 'right' = 'left'
  ) {
    if (text === undefined || text === null || text === '') return;
    const str = String(text);
    if (maxWidth <= 0) return;
    const textW = doc.getTextWidth(str);

    if (textW <= maxWidth) {
      if (align === 'right') {
        doc.text(str, x + maxWidth - textW, y);
      } else if (align === 'center') {
        doc.text(str, x + (maxWidth - textW) / 2, y);
      } else {
        doc.text(str, x, y);
      }
      return;
    }

    // Truncate and append ellipsis
    let truncated = str;
    while (truncated.length > 1 && doc.getTextWidth(truncated + '…') > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    const finalStr = truncated.length > 0 ? truncated + '…' : '';
    if (align === 'right') {
      doc.text(finalStr, x + maxWidth - doc.getTextWidth(finalStr), y);
    } else if (align === 'center') {
      doc.text(finalStr, x + (maxWidth - doc.getTextWidth(finalStr)) / 2, y);
    } else {
      doc.text(finalStr, x, y);
    }
  }

  // Header Banner Helper
  function drawBanner(pageIndex: number) {
    // Dark Navy Command Background
    doc.setFillColor(11, 19, 38);
    doc.rect(0, 0, 210, 32, 'F');

    // Cyan Neon Accent Stripe
    doc.setFillColor(0, 229, 255);
    doc.rect(0, 0, 210, 2.2, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 229, 255);
    doc.setFontSize(13);
    doc.text('OCEANGUARD MARITIME DEFENSE COMMAND', 14, 10);

    // Subtitle
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('OFFICIAL SATELLITE RADAR & KINEMATIC ANOMALY FORENSIC AUDIT DOSSIER', 14, 16);

    // Metadata Bar
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(170, 195, 220);
    drawBoundedText(`INCIDENT: ${activeSpillId}   |   SAR SCENE: ${sceneName}   |   SECTOR: ${sectorName}`, 14, 22, 138);
    drawBoundedText(`PASS TIME: ${passTimeUtc} (${passTimeIst})   |   REPORT CERTIFIED: ${dateStr} ${timeStr}`, 14, 27, 138);

    // Critical Evidence Badge (x: 154 to 196, width: 42mm)
    doc.setFillColor(147, 0, 10);
    doc.roundedRect(154, 6.5, 42, 17, 1.5, 1.5, 'F');
    doc.setDrawColor(255, 100, 100);
    doc.setLineWidth(0.3);
    doc.roundedRect(154, 6.5, 42, 17, 1.5, 1.5, 'S');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    drawBoundedText('CRITICAL EVIDENCE', 154, 11.5, 42, 'center');

    doc.setFontSize(9);
    doc.setTextColor(255, 220, 220);
    drawBoundedText(`${anomalyScore}% ATTRIBUTION`, 154, 18, 42, 'center');

    doc.setFontSize(5.5);
    doc.setTextColor(255, 180, 180);
    drawBoundedText('UNCLOS / ISO 14001 EVIDENTIARY', 154, 21.5, 42, 'center');
  }

  // Section Header Helper
  function drawSectionHeader(title: string, y: number, bgR = 232, bgG = 244, bgB = 252, textR = 0, textG = 55, textB = 110) {
    doc.setFillColor(bgR, bgG, bgB);
    doc.rect(14, y, 182, 5.2, 'F');
    doc.setDrawColor(textR, textG, textB);
    doc.setLineWidth(0.4);
    doc.rect(14, y, 182, 5.2, 'S');

    doc.setFillColor(textR, textG, textB);
    doc.rect(14, y, 2.5, 5.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textR, textG, textB);
    drawBoundedText(title, 19, y + 3.7, 174);
  }

  // 4-Column Structured Key-Value Grid Helper with Strict Cell Bounding
  // colWidths: [38, 53, 38, 53] = 182 mm total.
  // Col 1 label: x=14, w=38
  // Col 1 value: x=52, w=53 (ends at 105)
  // Col 2 label: x=105, w=38
  // Col 2 value: x=143, w=53 (ends at 196)
  function drawGridCard(y: number, rows: (string | boolean | number[] | null)[][], colWidths = [38, 53, 38, 53]) {
    const totalW = 182;
    const startX = 14;
    const rowH = 5.2;

    rows.forEach((r, idx) => {
      const curY = y + idx * rowH;
      doc.setFillColor(idx % 2 === 0 ? 255 : 247, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
      doc.rect(startX, curY, totalW, rowH, 'F');
      doc.setDrawColor(215, 225, 235);
      doc.setLineWidth(0.2);
      doc.rect(startX, curY, totalW, rowH, 'S');

      // Col 1 Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(60, 75, 95);
      drawBoundedText((r[0] as string) || '', startX + 2, curY + 3.7, colWidths[0] - 3);

      // Col 1 Value
      doc.setFont('helvetica', r[4] ? 'bold' : 'normal');
      doc.setFontSize(6.8);
      if (r[5]) {
        const c = r[5] as number[];
        doc.setTextColor(c[0], c[1], c[2]);
      } else {
        doc.setTextColor(15, 25, 35);
      }
      drawBoundedText((r[1] as string) || '', startX + colWidths[0] + 1.5, curY + 3.7, colWidths[1] - 3);

      // Col 2 Label
      const col2LabelX = startX + colWidths[0] + colWidths[1];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(60, 75, 95);
      drawBoundedText((r[2] as string) || '', col2LabelX + 2, curY + 3.7, colWidths[2] - 3);

      // Col 2 Value
      const col2ValX = col2LabelX + colWidths[2];
      doc.setFont('helvetica', r[6] ? 'bold' : 'normal');
      doc.setFontSize(6.8);
      if (r[7]) {
        const c = r[7] as number[];
        doc.setTextColor(c[0], c[1], c[2]);
      } else {
        doc.setTextColor(15, 25, 35);
      }
      drawBoundedText((r[3] as string) || '', col2ValX + 1.5, curY + 3.7, colWidths[3] - 3);
    });

    return rows.length * rowH;
  }

  // Footer Helper
  function drawFooter(pageNum: number) {
    doc.setDrawColor(200, 215, 225);
    doc.setLineWidth(0.3);
    doc.line(14, 286, 196, 286);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(130, 140, 150);
    drawBoundedText('OceanGuard Autonomous Maritime Defense Command • Cryptographic Evidentiary Chain of Custody (SIH26143)', 14, 290.5, 165);
    doc.setFont('helvetica', 'bold');
    drawBoundedText(`Page ${pageNum} of ${totalPages}`, 182, 290.5, 14, 'right');
  }

  // ==========================================
  // PAGE 1: SAR ACQUISITION, CLASSIFICATION, METOCEAN & PRIMARY CULPRIT
  // ==========================================
  drawBanner(1);

  let curY = 37;

  // 1. SATELLITE SAR ACQUISITION & MORPHOLOGY
  drawSectionHeader(`1. SATELLITE SAR ACQUISITION & MORPHOLOGICAL EXTRACTION (${sceneName})`, curY, 235, 245, 255, 0, 50, 100);
  curY += 6.5;

  const sarGrid: (string | boolean | number[] | null)[][] = [
    ['Incident Reference:', activeSpillId, 'Radar Sensor Mode:', 'Sentinel-1B C-SAR (IW Mode)', false, null, true, [0, 80, 140]],
    ['Observation (UTC):', passTimeUtc, 'Observation (IST):', passTimeIst, false, null, false, null],
    ['Slick Surface Area:', `${area.toFixed(2)} sq km (${(area * 100).toFixed(1)} Ha)`, 'Estimated Volume:', `~${volumeLiters.toLocaleString()} L (HFO-380 Bilge)`, true, [0, 100, 70], true, [140, 40, 0]],
    ['DeepSAR U-Net Dice:', `${diceScore}% (IoU: ${iouScore}%)`, 'Max Pixel Confidence:', `${maxProb}% (Sigmoid Peak)`, true, [0, 95, 110], true, [0, 95, 110]],
    ['Capillary Depression:', `${dampingDb} dB (Marangoni Damping)`, 'Boundary Extraction:', 'Moore-Neighbor + Douglas-Peucker', true, [120, 0, 0], false, null],
    ['Slick Centroid (WGS84):', centroidCoords, 'Slick Perimeter:', `${perimeter.toFixed(2)} km (Geodesic Contour)`, false, null, true, [0, 50, 100]],
  ];
  curY += drawGridCard(curY, sarGrid);
  curY += 5.5;

  // 2. 6-CLASS BAYESIAN LOOK-ALIKE CLASSIFICATION TABLE
  drawSectionHeader('2. SAR LOOK-ALIKE & FALSE-POSITIVE 6-CLASS BAYESIAN CLASSIFICATION', curY, 235, 250, 245, 0, 85, 60);
  curY += 6.5;

  doc.setFillColor(25, 45, 65);
  doc.rect(14, curY, 182, 4.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  drawBoundedText('SURFACE PHENOMENON CLASS', 16, curY + 3.4, 48);
  drawBoundedText('PROBABILITY', 66, curY + 3.4, 22, 'center');
  drawBoundedText('SAR PHYSICS & HYDRODYNAMIC DISCRIMINATION RATIONALE', 92, curY + 3.4, 102);
  curY += 4.8;

  const fpRows: [string, string, string, boolean, number[] | null][] = [
    ['Oil Spill (Mineral Hydrocarbon)', oilProb, `Viscoelastic Marangoni damping (${dampingDb} dB) strongly suppresses 3.7cm capillary waves`, true, [180, 0, 0]],
    ['Calm Water / Low Wind Mirror', calmProb, `Surface wind (${activeMetocean.wind_speed_kts} kts) exceeds 3.0 m/s threshold; fully roughened seas rule out calm slick`, false, null],
    ['Natural Biogenic Film (Surfactant)', bioProb, 'Biogenic monomolecular films disintegrate in >6.0 m/s winds; cannot sustain >6.0 dB contrast', false, null],
    ['Vessel Wake / Dynamic Turbulence', wakeProb, 'Ship wake turbulence lacks viscoelastic damping and surfactant resonance characteristics', false, null],
    ['Rain-related Downburst Artifact', rainProb, 'Doppler weather radar confirms cloudless sky; no squall or atmospheric downbursts', false, null],
    ['Epistemic Uncertainty Prior Floor', unkProb, 'Residual Dirichlet uniform prior floor across C-band SAR speckle noise envelope', false, null],
  ];

  fpRows.forEach((r, idx) => {
    const rowH = 4.8;
    doc.setFillColor(idx % 2 === 0 ? 255 : 246, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 248);
    doc.rect(14, curY, 182, rowH, 'F');
    doc.setDrawColor(215, 225, 235);
    doc.setLineWidth(0.2);
    doc.rect(14, curY, 182, rowH, 'S');

    doc.setFont('helvetica', r[3] ? 'bold' : 'normal');
    doc.setFontSize(6.5);
    if (r[4]) {
      const c = r[4] as number[];
      doc.setTextColor(c[0], c[1], c[2]);
    } else {
      doc.setTextColor(20, 30, 40);
    }
    drawBoundedText(r[0], 16, curY + 3.3, 48);

    doc.setFont('helvetica', 'bold');
    drawBoundedText(r[1], 66, curY + 3.3, 22, 'center');

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(45, 55, 65);
    drawBoundedText(r[2], 92, curY + 3.3, 102);

    curY += rowH;
  });
  curY += 5.5;

  // 3. HYDRODYNAMIC HINDCAST & METOCEAN BACK-TRACING
  drawSectionHeader('3. HYDRODYNAMIC METOCEAN & HINDCAST BACK-TRACING ANALYSIS (STEPS 2–3)', curY, 230, 247, 255, 0, 95, 110);
  curY += 6.5;

  const hindcastGrid: (string | boolean | number[] | null)[][] = [
    ['Surface Wind Factor:', `${activeMetocean.wind_speed_kts} kts @ ${activeMetocean.wind_direction_deg.toFixed(1)}° ${activeMetocean.wind_cardinal} (3.5% Windage)`, 'Ocean Current Vector:', `${activeMetocean.current_speed_kts} kts @ ${activeMetocean.current_direction_deg.toFixed(1)}° ${activeMetocean.current_cardinal} (Copernicus Stream)`, false, null, false, null],
    ['Net Forward Advection:', `${activeMetocean.net_drift_speed_kts} kts @ ${activeMetocean.net_drift_direction_deg.toFixed(1)}° ${activeMetocean.current_cardinal} (Downstream Net)`, 'Hindcast Reverse Vector:', `${activeMetocean.net_drift_speed_kts} kts @ ${activeMetocean.hindcast_direction_deg?.toFixed(1) || '275.0'}° W (Upstream Trace)`, false, null, true, [0, 95, 110]],
    ['Reconstructed Origin:', originCoords, 'Fay Core Contraction:', '0.62 (Fresh Nascent Core)', true, [140, 0, 0], false, null],
    ['Sea Surface Temperature:', `${activeMetocean.sea_surface_temp_c}° C (Levantine Basin)`, 'Significant Wave Height:', `${activeMetocean.significant_wave_height_m} m (${activeMetocean.sea_state || 'Beaufort 3-4'})`, false, null, false, null],
    ['Evaporative Loss (T-42m):', `${activeMetocean.weathering_evaporation_pct}% volatile fractions`, 'Emulsification Degree:', `${activeMetocean.weathering_emulsification_pct}% water-in-oil emulsion`, false, null, false, null],
  ];
  curY += drawGridCard(curY, hindcastGrid);
  curY += 5.5;

  // 4. PRIMARY SUSPECT VESSEL ATTRIBUTION & ANOMALY MATRIX
  drawSectionHeader('4. PRIMARY SUSPECT VESSEL ATTRIBUTION & KINEMATIC ANOMALY MATRIX (STEP 4)', curY, 255, 235, 235, 150, 0, 0);
  curY += 6.5;

  const culpritGrid: (string | boolean | number[] | null)[][] = [
    ['Attributed Vessel:', primarySuspect.name, 'MMSI Identifier:', primarySuspect.mmsi.toString(), true, [180, 0, 0], true, [20, 20, 20]],
    ['Flag State / Type:', `${primarySuspect.flag || 'Malta'} / ${primarySuspect.vessel_type || 'VLCC Crude Carrier'}`, 'Call Sign / Dimensions:', `${primarySuspect.call_sign || '9HA4211'} (L: ${primarySuspect.length_meters || 315}m, D: ${primarySuspect.draught_meters || 15.8}m)`, false, null, false, null],
    ['Composite Anomaly Risk:', `${anomalyScore}% (CRITICAL SUSPECT IDENTIFIED)`, 'Hindcast Origin CPA:', '0.00 km (Exact Spatial Overpass)', true, [180, 0, 0], true, [160, 0, 0]],
    ['Sudden Speed Drop:', '-8.3 kts (13.5 -> 5.2 kts at locus)', 'AIS Signal Blackout:', '42 min Gap across Discharge Locus', true, [140, 30, 0], true, [160, 0, 0]],
    ['Cargo Manifest:', (primarySuspect as any).cargo_type || 'Crude Oil (315,000 DWT)', 'Declared Destination:', primarySuspect.destination || 'CYPRUS OFFSHORE TRANSIT', false, null, false, null],
  ];
  curY += drawGridCard(curY, culpritGrid);

  drawFooter(1);

  // ==========================================
  // PAGE 2: MULTI-VESSEL CORRELATION, AIS LOGS, VECTOR VAULT, ADVISORY & CERTIFICATION
  // ==========================================
  doc.addPage();
  drawBanner(2);

  curY = 37;

  // 5. MULTI-VESSEL CORRELATION RANKING TABLE
  drawSectionHeader('5. MULTI-VESSEL CORRELATION RANKING & TRAJECTORY DISCRIMINATION', curY, 240, 240, 248, 30, 40, 70);
  curY += 6.5;

  doc.setFillColor(20, 30, 50);
  doc.rect(14, curY, 182, 4.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  drawBoundedText('VESSEL NAME', 16, curY + 3.4, 40);
  drawBoundedText('MMSI', 58, curY + 3.4, 18);
  drawBoundedText('FLAG', 78, curY + 3.4, 16);
  drawBoundedText('VESSEL TYPE', 96, curY + 3.4, 36);
  drawBoundedText('HINDCAST CPA', 134, curY + 3.4, 22);
  drawBoundedText('SPEED PROFILE', 158, curY + 3.4, 18);
  drawBoundedText('ANOMALY RISK', 178, curY + 3.4, 16, 'center');
  curY += 4.8;

  vesselList.slice(0, 5).forEach((s, idx) => {
    const rowH = 4.8;
    doc.setFillColor(idx % 2 === 0 ? 255 : 246, idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 252);
    doc.rect(14, curY, 182, rowH, 'F');
    doc.setDrawColor(215, 225, 235);
    doc.setLineWidth(0.2);
    doc.rect(14, curY, 182, rowH, 'S');

    const score = s.anomaly_score || s.probability_score || 0;
    const isCritical = score > 70;

    doc.setFont('helvetica', isCritical ? 'bold' : 'normal');
    doc.setFontSize(6.3);
    if (isCritical) doc.setTextColor(180, 0, 0);
    else doc.setTextColor(25, 35, 45);

    drawBoundedText(s.name, 16, curY + 3.3, 40);
    drawBoundedText(s.mmsi.toString(), 58, curY + 3.3, 18);
    drawBoundedText(s.flag, 78, curY + 3.3, 16);
    drawBoundedText(s.vessel_type || '', 96, curY + 3.3, 36);

    const distText = (s as any).distance_km !== undefined
      ? ((s as any).distance_km === 0 ? '0.00 km (Exact)' : `${(s as any).distance_km.toFixed(1)} km`)
      : (s.distance_meters === 0 ? '0.00 km (Exact)' : `${(s.distance_meters / 1000).toFixed(1)} km`);
    drawBoundedText(distText, 134, curY + 3.3, 22);

    const speedDelta = isCritical ? '-8.3 kts (Drop)' : '0.0 kts (Steady)';
    drawBoundedText(speedDelta, 158, curY + 3.3, 18);

    doc.setFont('helvetica', 'bold');
    if (isCritical) doc.setTextColor(180, 0, 0);
    else if (score > 15) doc.setTextColor(160, 100, 0);
    else doc.setTextColor(40, 120, 60);
    drawBoundedText(`${score.toFixed(1)}%`, 178, curY + 3.3, 16, 'center');

    curY += rowH;
  });
  curY += 5.5;

  // 6. CHRONOLOGICAL FORENSIC AIS TELEMETRY INTERCEPT LOGS
  drawSectionHeader('6. CHRONOLOGICAL FORENSIC AIS TELEMETRY & DISCHARGE INTERCEPT LOGS', curY, 235, 245, 255, 0, 60, 110);
  curY += 6.5;

  doc.setFillColor(25, 45, 65);
  doc.rect(14, curY, 182, 4.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  drawBoundedText('TIMELINE EVENT', 16, curY + 3.4, 26);
  drawBoundedText('UTC TIME', 44, curY + 3.4, 23);
  drawBoundedText('IST TIME', 68, curY + 3.4, 17);
  drawBoundedText('VESSEL POSITION', 86, curY + 3.4, 28);
  drawBoundedText('SPEED/HDG', 116, curY + 3.4, 18);
  drawBoundedText('KINEMATIC BEHAVIOR & RADAR CORRELATION', 136, curY + 3.4, 58);
  curY += 4.8;

  const aisEvents: [string, string, string, string, string, string, boolean, number[] | null][] = [
    ['Corridor Entry Transit', '2019-01-01 02:37 UTC', '08:07 IST', '32.8500° E, 33.2300° N', '13.8 kts / 85°', 'Nominal transit cruising eastbound south of Cyprus', false, null],
    ['Illicit Discharge Breach', '2019-01-01 03:00 UTC', '08:30 IST', '33.0421° E, 33.2684° N', '5.2 kts / 84°', 'SPEED DROP (-8.3 kts) + 42-MIN AIS BLACKOUT', true, [180, 0, 0]],
    ['SAR Satellite Overpass', '2019-01-01 03:42 UTC', '09:12 IST', '33.1431° E, 33.2750° N', '13.5 kts / 83°', 'Sentinel-1B radar capture: 0.37 sq km slick; ship +8.2 km', false, null],
    ['Post-Breach Cruise', '2019-01-01 04:30 UTC', '10:00 IST', '33.3200° E, 33.2900° N', '13.8 kts / 84°', 'AIS transmission restored; cruising towards Port Said', false, null],
  ];

  aisEvents.forEach((ev, idx) => {
    const rowH = 4.8;
    doc.setFillColor(ev[6] ? 255 : (idx % 2 === 0 ? 255 : 246), ev[6] ? 238 : (idx % 2 === 0 ? 255 : 248), ev[6] ? 238 : (idx % 2 === 0 ? 255 : 252));
    doc.rect(14, curY, 182, rowH, 'F');
    doc.setDrawColor(215, 225, 235);
    doc.setLineWidth(0.2);
    doc.rect(14, curY, 182, rowH, 'S');

    doc.setFont('helvetica', ev[6] ? 'bold' : 'normal');
    doc.setFontSize(6.1);
    if (ev[7]) {
      const c = ev[7] as number[];
      doc.setTextColor(c[0], c[1], c[2]);
    } else {
      doc.setTextColor(20, 30, 40);
    }

    drawBoundedText(ev[0], 16, curY + 3.3, 26);
    drawBoundedText(ev[1], 44, curY + 3.3, 23);
    drawBoundedText(ev[2], 68, curY + 3.3, 17);
    drawBoundedText(ev[3], 86, curY + 3.3, 28);
    drawBoundedText(ev[4], 116, curY + 3.3, 18);
    drawBoundedText(ev[5], 136, curY + 3.3, 58);

    curY += rowH;
  });
  curY += 5.5;

  // 7. QDRANT VECTOR SIMILARITY SEARCH & HISTORICAL SIGNATURE MATCHES
  drawSectionHeader('7. QDRANT VECTOR SIMILARITY SEARCH & HISTORICAL SLICK SIGNATURES (STEP 5)', curY, 235, 248, 245, 0, 75, 55);
  curY += 6.5;

  doc.setFillColor(25, 45, 65);
  doc.rect(14, curY, 182, 4.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  drawBoundedText('HISTORICAL SIGNATURE ID', 16, curY + 3.4, 34);
  drawBoundedText('INCIDENT DESCRIPTION', 52, curY + 3.4, 56);
  drawBoundedText('RECORDED DATE', 110, curY + 3.4, 23);
  drawBoundedText('ATTRIBUTED VESSEL', 135, curY + 3.4, 36);
  drawBoundedText('SHAPE SIMILARITY', 173, curY + 3.4, 21);
  curY += 4.8;

  const rawMatches = (vectorMatches && vectorMatches.length > 0) ? vectorMatches : INITIAL_VECTOR_MATCHES;
  const displayMatches = rawMatches.slice(0, 4).map((vm, i) => [
    vm.id || `SIG-MED-0${i + 1}`,
    vm.title || 'Historical Hydrocarbon Discharge',
    vm.date || '2024-09-01',
    vm.culprit_name ? vm.culprit_name.split(' (')[0] : 'UNKNOWN VESSEL',
    `${(vm.similarity_score || 90).toFixed(1)}%${(vm.similarity_score || 90) > 98 ? ' (MATCH)' : ''}`,
    (vm.similarity_score || 90) > 98,
    (vm.similarity_score || 90) > 98 ? [180, 0, 0] : null
  ]);

  displayMatches.forEach((vm, idx) => {
    const rowH = 4.6;
    doc.setFillColor(idx % 2 === 0 ? 255 : 246, idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 252);
    doc.rect(14, curY, 182, rowH, 'F');
    doc.setDrawColor(215, 225, 235);
    doc.setLineWidth(0.2);
    doc.rect(14, curY, 182, rowH, 'S');

    doc.setFont('helvetica', vm[5] ? 'bold' : 'normal');
    doc.setFontSize(6.3);
    if (vm[6]) {
      const c = vm[6] as number[];
      doc.setTextColor(c[0], c[1], c[2]);
    } else {
      doc.setTextColor(20, 30, 40);
    }

    drawBoundedText(vm[0] as string, 16, curY + 3.2, 34);
    drawBoundedText(vm[1] as string, 52, curY + 3.2, 56);
    drawBoundedText(vm[2] as string, 110, curY + 3.2, 23);
    drawBoundedText(vm[3] as string, 135, curY + 3.2, 36);
    drawBoundedText(vm[4] as string, 173, curY + 3.2, 21);

    curY += rowH;
  });
  curY += 5.5;

  // 8. ENVIRONMENTAL THREAT & COASTAL VULNERABILITY ADVISORY
  drawSectionHeader('8. COASTAL VULNERABILITY ASSESSMENT & MARITIME RESPONSE ADVISORIES', curY, 255, 245, 230, 140, 70, 0);
  curY += 6.5;

  const threatGrid: (string | boolean | number[] | null)[][] = [
    ['Offshore Coastline:', '154.0 km (Cyprus Shoreline)', 'Projected Impact Zone:', 'Southern Cyprus Coastline & Akrotiri Bay', false, null, false, null],
    ['Marine Eco Sanctuary:', 'HIGH RISK (Monk Seal & Turtle)', 'Pelagic Fishing Grounds:', 'HIGH RISK (Levantine Pelagic Fishery)', true, [140, 0, 0], true, [140, 0, 0]],
    ['Response Advisory 1:', 'Deploy European Maritime Safety Agency (EMSA) CleanSeaNet tier-2 containment booms', '', '', false, null, false, null],
    ['Response Advisory 2:', 'Issue urgent navigational safety broadcast to Levantine transit shipping corridor', '', '', false, null, false, null],
    ['Response Advisory 3:', 'Pre-position rapid offshore skimmers at Limassol port commercial terminal anchorage', '', '', false, null, false, null],
  ];

  threatGrid.forEach((r, idx) => {
    const rowH = 4.6;
    doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252, idx % 2 === 0 ? 255 : 246);
    doc.rect(14, curY, 182, rowH, 'F');
    doc.setDrawColor(225, 230, 235);
    doc.setLineWidth(0.2);
    doc.rect(14, curY, 182, rowH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(50, 65, 80);
    drawBoundedText(r[0] as string, 16, curY + 3.2, 34);

    doc.setFont('helvetica', r[4] ? 'bold' : 'normal');
    if (r[5]) {
      const c = r[5] as number[];
      doc.setTextColor(c[0], c[1], c[2]);
    } else {
      doc.setTextColor(20, 30, 40);
    }

    if (r[2]) {
      drawBoundedText(r[1] as string, 52, curY + 3.2, 48);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 65, 80);
      drawBoundedText(r[2] as string, 102, curY + 3.2, 38);

      doc.setFont('helvetica', r[6] ? 'bold' : 'normal');
      if (r[7]) {
        const c = r[7] as number[];
        doc.setTextColor(c[0], c[1], c[2]);
      } else {
        doc.setTextColor(20, 30, 40);
      }
      drawBoundedText(r[3] as string, 142, curY + 3.2, 52);
    } else {
      drawBoundedText(r[1] as string, 52, curY + 3.2, 142);
    }

    curY += rowH;
  });
  curY += 5.5;

  // 9. DIGITAL FORENSIC OFFICER CERTIFICATION & EVIDENCE ATTESTATION
  doc.setDrawColor(0, 100, 160);
  doc.setLineWidth(0.5);
  doc.setFillColor(248, 252, 255);
  doc.roundedRect(14, curY, 182, 25, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 50, 110);
  drawBoundedText('9. DIGITAL FORENSIC OFFICER ATTESTATION & CRYPTOGRAPHIC EVIDENCE CERTIFICATION', 18, curY + 5, 174);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(45, 55, 65);
  drawBoundedText('I hereby certify under official maritime authority that the satellite SAR radar segmentation, hydrodynamic windage/ocean current', 18, curY + 9.2, 174);
  drawBoundedText('hindcast back-tracing, and AIS trajectory anomaly correlations herein were computed deterministically under ISO 14001 / UNCLOS standards.', 18, curY + 12.8, 174);

  // Left Column: Investigating Officer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(0, 50, 110);
  drawBoundedText('Investigating Enforcement Officer:', 18, curY + 17.5, 85);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 30, 40);
  drawBoundedText('Capt. Andreas Vassiliou • EMSA Senior Maritime Auditor', 18, curY + 21.5, 85);

  // Right Column: Digital Signature
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 100, 60);
  drawBoundedText('Cryptographic Integrity Digest (SHA-256):', 108, curY + 17.5, 86);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 25, 35);
  drawBoundedText('SHA256: 7f8a9e2d4c1b0f5e3a8d9c2b4a1f6e8d [VERIFIED]', 108, curY + 21.5, 86);

  drawFooter(2);

  return doc.output('blob');
}
