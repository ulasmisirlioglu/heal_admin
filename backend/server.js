import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============= BIOMARKER SYSTEM MAPPING =============
const biomarkerSystemMapping = {
  'Erythrozyten': 'Blood',
  'Hämoglobin (Hb)': 'Blood',
  'Hämatokrit': 'Blood',
  'MCV': 'Blood',
  'MCH': 'Blood',
  'MCHC': 'Blood',
  'Thrombozyten': 'Blood',
  'Leukozyten': 'Blood',
  'Stabkern. Neutrophile': 'Blood',
  'Segmentkern. Neutrophile': 'Blood',
  'Eosinophile': 'Blood',
  'Basophile': 'Blood',
  'Lymphozyten': 'Blood',
  'Monozyten': 'Blood',
  'hsCRP': 'Blood',
  'LDH': 'Blood',
  'CK': 'Blood',
  'Total Cholesterol': 'Heart',
  'LDL': 'Heart',
  'HDL': 'Heart',
  'Triglyzeride': 'Heart',
  'Apolipoprotein B (ApoB)': 'Heart',
  'Apolipoprotein A1 (ApoA1)': 'Heart',
  'Lipoprotein(a) [Lp(a)]': 'Heart',
  'Omega-3-Index (EPA+DHA, Erythrozyten)': 'Heart',
  'Homocystein': 'Heart',
  'TSH': 'Hormones',
  'ft3': 'Hormones',
  'Ft4': 'Hormones',
  'Cortisol': 'Hormones',
  'Testosteron, gesamt': 'Hormones',
  'Testosteron, frei': 'Hormones',
  'Estradiol': 'Hormones',
  'Progesteron': 'Hormones',
  'Prolactin': 'Hormones',
  'FSH': 'Hormones',
  'LH': 'Hormones',
  'DHEA-S': 'Hormones',
  'SHBG': 'Hormones',
  'PSA': 'Hormones',
  'IgG': 'Immunity',
  'IgA': 'Immunity',
  'IgM': 'Immunity',
  'Kreatinin': 'Kidneys',
  'eGFR': 'Kidneys',
  'Harnstoff (BUN)': 'Kidneys',
  'Osmolalität': 'Kidneys',
  'GGT': 'Liver',
  'GPT': 'Liver',
  'GOT': 'Liver',
  'AP': 'Liver',
  'Billirubin': 'Liver',
  'Gesamteiweiß': 'Liver',
  'CHE': 'Liver',
  'Albumin': 'Liver',
  'Glucose': 'Metabolism',
  'HbA1c': 'Metabolism',
  'Insulin': 'Metabolism',
  'Harnsäure': 'Metabolism',
  'Amylase': 'Metabolism',
  'Lipase': 'Metabolism',
  'Vitamin B12': 'Vitamins',
  'Vitamin D3/25OH': 'Vitamins',
  'Folat (Vitamin B9)': 'Vitamins',
  'Selen': 'Minerals',
  'Zink': 'Minerals',
  'Magnesium': 'Minerals',
  'Ferritin': 'Minerals',
  'Transferrinsättigung': 'Minerals',
  'Kupfer': 'Minerals',
  'Eisen': 'Minerals',
  'Phosphat': 'Minerals',
  'GSH/Glutation': 'Minerals',
  'Natrium': 'Minerals',
  'Kalium': 'Minerals',
  'Calcium': 'Minerals',
  'Chlorid': 'Minerals',
};

// ============= FUZZY MATCHING UTILITIES =============
function normalizeBiomarkerName(name) {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/[^\w\säöüß-]/g, '').trim();
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function findBestBiomarkerMatch(extractedName) {
  if (biomarkerSystemMapping[extractedName]) return { matchedName: extractedName, matchType: 'exact', confidence: 1.0 };
  const normalizedExtracted = normalizeBiomarkerName(extractedName);
  let bestMatch = null, bestDistance = Infinity;
  const threshold = 0.75;
  for (const knownName of Object.keys(biomarkerSystemMapping)) {
    const normalizedKnown = normalizeBiomarkerName(knownName);
    if (normalizedExtracted === normalizedKnown) return { matchedName: knownName, matchType: 'fuzzy', confidence: 0.95 };
    const distance = levenshteinDistance(normalizedExtracted, normalizedKnown);
    const maxLength = Math.max(normalizedExtracted.length, normalizedKnown.length);
    const similarity = 1 - (distance / maxLength);
    if (similarity >= threshold && distance < bestDistance) { bestDistance = distance; bestMatch = knownName; }
  }
  if (bestMatch) {
    const maxLength = Math.max(normalizeBiomarkerName(extractedName).length, normalizeBiomarkerName(bestMatch).length);
    return { matchedName: bestMatch, matchType: 'fuzzy', confidence: 1 - (bestDistance / maxLength) };
  }
  return { matchedName: null, matchType: 'none', confidence: 0 };
}

function cleanJson(s) {
  return s.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
}

// ============= GET /api/pending-bookings =============
app.get('/api/pending-bookings', async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('booked_tests')
      .select('*')
      .eq('booking_status', 'pending')
      .order('booking_time', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const userIds = [...new Set(bookings.map(b => b.user_id))];

    const { data: profiles } = await supabase
      .from('user_health_profiles')
      .select('user_id, name, date_of_birth, biological_sex')
      .in('user_id', userIds);

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

    const combined = bookings.map(b => ({
      ...b,
      profile: profileMap[b.user_id] || null,
    }));

    res.json(combined);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= POST /api/reject-booking =============
app.post('/api/reject-booking', async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'Missing booking_id' });

    const { error } = await supabase
      .from('booked_tests')
      .update({ booking_status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', booking_id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, booking_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= GET /api/pending-content =============
app.get('/api/pending-content', async (req, res) => {
  try {
    // Get test results with approval_status = 'pending'
    const { data: testResults, error } = await supabase
      .from('test_results')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!testResults || testResults.length === 0) return res.json([]);

    const userIds = [...new Set(testResults.map(t => t.user_id))];
    const testResultIds = testResults.map(t => t.id);

    // Get user profiles
    const { data: profiles } = await supabase
      .from('user_health_profiles')
      .select('user_id, name')
      .in('user_id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

    // Get summaries
    const { data: summaries } = await supabase
      .from('health_summaries')
      .select('*')
      .in('test_result_id', testResultIds);
    const summaryMap = {};
    (summaries || []).forEach(s => { summaryMap[s.test_result_id] = s; });

    // Get action plans
    const { data: actionPlans } = await supabase
      .from('action_plans')
      .select('*')
      .in('test_result_id', testResultIds);
    const actionPlanMap = {};
    (actionPlans || []).forEach(a => { actionPlanMap[a.test_result_id] = a; });

    // Get daily objectives
    const actionPlanIds = (actionPlans || []).map(a => a.id);
    const { data: dailyObjectives } = await supabase
      .from('daily_objectives')
      .select('*')
      .in('action_plan_id', actionPlanIds);
    const objectivesMap = {};
    (dailyObjectives || []).forEach(d => { objectivesMap[d.action_plan_id] = d; });

    // Combine data
    const combined = testResults.map(tr => ({
      test_result: tr,
      user: profileMap[tr.user_id] || { name: 'Unknown' },
      summary: summaryMap[tr.id] || null,
      action_plan: actionPlanMap[tr.id] || null,
      daily_objectives: actionPlanMap[tr.id] ? objectivesMap[actionPlanMap[tr.id].id] || null : null,
    }));

    res.json(combined);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= PATCH /api/update-content =============
app.patch('/api/update-content', async (req, res) => {
  try {
    const { test_result_id, summary, action_plan, daily_objectives, biomarker_results } = req.body;
    if (!test_result_id) return res.status(400).json({ error: 'Missing test_result_id' });

    // Update biomarker results if provided
    if (biomarker_results !== undefined) {
      await supabase
        .from('test_results')
        .update({ results: biomarker_results, updated_at: new Date().toISOString() })
        .eq('id', test_result_id);
    }

    // Update summary if provided
    if (summary !== undefined) {
      await supabase
        .from('health_summaries')
        .update({ summary_text: summary, updated_at: new Date().toISOString() })
        .eq('test_result_id', test_result_id);
    }

    // Update action plan if provided
    if (action_plan !== undefined) {
      await supabase
        .from('action_plans')
        .update({ plan_data: action_plan, updated_at: new Date().toISOString() })
        .eq('test_result_id', test_result_id);
    }

    // Update daily objectives if provided
    if (daily_objectives !== undefined) {
      const { data: ap } = await supabase
        .from('action_plans')
        .select('id')
        .eq('test_result_id', test_result_id)
        .single();
      if (ap) {
        await supabase
          .from('daily_objectives')
          .update({ objectives: daily_objectives })
          .eq('action_plan_id', ap.id);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= POST /api/approve-content =============
app.post('/api/approve-content', async (req, res) => {
  try {
    const { test_result_id } = req.body;
    if (!test_result_id) return res.status(400).json({ error: 'Missing test_result_id' });

    const { error } = await supabase
      .from('test_results')
      .update({ approval_status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', test_result_id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= GET /api/approved-content =============
app.get('/api/approved-content', async (req, res) => {
  try {
    // Get test results with approval_status = 'approved'
    const { data: testResults, error } = await supabase
      .from('test_results')
      .select('*')
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!testResults || testResults.length === 0) return res.json([]);

    const userIds = [...new Set(testResults.map(t => t.user_id))];
    const testResultIds = testResults.map(t => t.id);

    // Get user profiles
    const { data: profiles } = await supabase
      .from('user_health_profiles')
      .select('user_id, name')
      .in('user_id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

    // Get summaries
    const { data: summaries } = await supabase
      .from('health_summaries')
      .select('*')
      .in('test_result_id', testResultIds);
    const summaryMap = {};
    (summaries || []).forEach(s => { summaryMap[s.test_result_id] = s; });

    // Get action plans
    const { data: actionPlans } = await supabase
      .from('action_plans')
      .select('*')
      .in('test_result_id', testResultIds);
    const actionPlanMap = {};
    (actionPlans || []).forEach(a => { actionPlanMap[a.test_result_id] = a; });

    // Get daily objectives
    const actionPlanIds = (actionPlans || []).map(a => a.id);
    const { data: dailyObjectives } = actionPlanIds.length > 0
      ? await supabase.from('daily_objectives').select('*').in('action_plan_id', actionPlanIds)
      : { data: [] };
    const objectivesMap = {};
    (dailyObjectives || []).forEach(d => { objectivesMap[d.action_plan_id] = d; });

    // Combine data
    const combined = testResults.map(tr => ({
      test_result: tr,
      user: profileMap[tr.user_id] || { name: 'Unknown' },
      summary: summaryMap[tr.id] || null,
      action_plan: actionPlanMap[tr.id] || null,
      daily_objectives: actionPlanMap[tr.id] ? objectivesMap[actionPlanMap[tr.id].id] || null : null,
    }));

    res.json(combined);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= GET /api/cancelled-bookings =============
app.get('/api/cancelled-bookings', async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('booked_tests')
      .select('*')
      .eq('booking_status', 'cancelled')
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const userIds = [...new Set(bookings.map(b => b.user_id))];

    const { data: profiles } = userIds.length > 0
      ? await supabase
          .from('user_health_profiles')
          .select('user_id, name, date_of_birth, biological_sex')
          .in('user_id', userIds)
      : { data: [] };

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

    const combined = bookings.map(b => ({
      ...b,
      profile: profileMap[b.user_id] || null,
    }));

    res.json(combined);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= GET /api/booked-tests =============
app.get('/api/booked-tests', async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('booked_tests')
      .select('*')
      .eq('booking_status', 'approved')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const userIds = [...new Set(bookings.map(b => b.user_id))];

    const { data: profiles } = await supabase
      .from('user_health_profiles')
      .select('user_id, name, date_of_birth, biological_sex')
      .in('user_id', userIds);

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

    const { data: results } = await supabase
      .from('test_results')
      .select('user_id, test_date, status')
      .in('user_id', userIds)
      .eq('status', 'completed');

    const resultSet = new Set();
    (results || []).forEach(r => { resultSet.add(`${r.user_id}_${r.test_date}`); });

    const combined = bookings.map(b => ({
      ...b,
      profile: profileMap[b.user_id] || null,
      hasResults: resultSet.has(`${b.user_id}_${b.booking_details?.date}`)
    }));

    res.json(combined);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= POST /api/analyze-test =============
app.post('/api/analyze-test', async (req, res) => {
  const jobId = crypto.randomUUID();
  try {
    const { fileBase64, fileName, mimeType, userId, testDate } = req.body;

    if (!fileBase64 || !fileName || !mimeType || !userId) {
      return res.status(400).json({ error: 'Missing required fields: fileBase64, fileName, mimeType, userId' });
    }

    // STEP 1: Upload to Supabase Storage
    const fileExt = fileName.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const { error: uploadError } = await supabase.storage.from('test-results').upload(filePath, fileBuffer, { contentType: mimeType, upsert: false });
    if (uploadError) return res.status(500).json({ error: 'Failed to upload file to storage' });

    // STEP 2: Create test_results record
    const { data: testResult, error: testError } = await supabase
      .from('test_results')
      .insert({ user_id: userId, test_date: testDate || new Date().toISOString().split('T')[0], file_url: filePath, status: 'processing', lab_name: 'SYNLAB' })
      .select().single();
    if (testError) return res.status(500).json({ error: 'Failed to create test result record' });

    // STEP 3: AI extraction with Gemini 2.5 Flash via OpenRouter
    const extractionPrompt = `Extract ALL biomarker data from this medical lab report. Return ONLY a JSON object with this structure:
{
  "lab_name": "Lab name or null",
  "test_date": "YYYY-MM-DD or null",
  "biomarkers": [
    {"name": "Biomarker Name", "value": 5.2, "unit": "G/l", "referenceMin": 4.5, "referenceMax": 12.5}
  ]
}
Rules:
- Extract EVERY biomarker visible in the report
- Return a JSON OBJECT with "biomarkers" key, NOT a flat array
- Convert German decimals (13,5 → 13.5)
- For reference ranges: "4.1-5.1" → referenceMin: 4.1, referenceMax: 5.1; "<35" → referenceMin: 0, referenceMax: 35; ">40" → referenceMin: 40, referenceMax: 999
- No guessing, only extract visible data
- Return ONLY valid JSON, no markdown`;

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://heal-app.com', 'X-Title': 'heal Blood Test Analyzer' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'system', content: extractionPrompt }, { role: 'user', content: [{ type: 'text', text: 'Extract all biomarker data from this blood test report.' }, { type: 'image_url', image_url: { url: dataUrl } }] }], temperature: 0.1, max_tokens: 8000 })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[${jobId}] ❌ OpenRouter API Error:`, aiResponse.status, errorText);
      await supabase.from('test_results').update({ status: 'failed' }).eq('id', testResult.id);
      let detail = '';
      try { detail = JSON.parse(errorText)?.error?.message || errorText; } catch { detail = errorText; }
      return res.status(500).json({ error: 'AI extraction failed', detail, status: aiResponse.status });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content ?? '';

    // STEP 4: Parse JSON
    let parsedData;
    try {
      const rawParsed = JSON.parse(cleanJson(aiContent));
      parsedData = Array.isArray(rawParsed) ? { lab_name: null, test_date: null, biomarkers: rawParsed } : rawParsed;
    } catch (parseError) {
      await supabase.from('test_results').update({ status: 'failed' }).eq('id', testResult.id);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // STEP 5: Validate biomarkers
    if (!parsedData.biomarkers || !Array.isArray(parsedData.biomarkers)) {
      await supabase.from('test_results').update({ status: 'failed' }).eq('id', testResult.id);
      return res.status(500).json({ error: 'No biomarkers extracted' });
    }

    const validBiomarkers = parsedData.biomarkers.filter((bio) => {
      if (!bio.name || typeof bio.name !== 'string') return false;
      if (typeof bio.value !== 'number' || isNaN(bio.value)) return false;
      if (!bio.unit || typeof bio.unit !== 'string') return false;
      const hasMin = typeof bio.referenceMin === 'number' && !isNaN(bio.referenceMin);
      const hasMax = typeof bio.referenceMax === 'number' && !isNaN(bio.referenceMax);
      if (!hasMin && !hasMax) return false;
      const match = findBestBiomarkerMatch(bio.name);
      if (match.matchType === 'fuzzy') bio._matchedName = match.matchedName;
      return true;
    });

    if (validBiomarkers.length === 0) {
      await supabase.from('test_results').update({ status: 'failed' }).eq('id', testResult.id);
      return res.status(500).json({ error: 'No valid biomarkers extracted' });
    }

    // STEP 6: Map to systems & calculate status
    const resultsJson = {};
    validBiomarkers.forEach((bio) => {
      const nameToMap = bio._matchedName || bio.name;
      const bodySystem = biomarkerSystemMapping[nameToMap] || 'Metabolism';
      const value = parseFloat(bio.value);
      const hasMin = typeof bio.referenceMin === 'number' && !isNaN(bio.referenceMin);
      const hasMax = typeof bio.referenceMax === 'number' && !isNaN(bio.referenceMax);
      const refMin = hasMin ? parseFloat(bio.referenceMin) : null;
      const refMax = hasMax ? parseFloat(bio.referenceMax) : null;

      let status;
      if (hasMin && hasMax) {
        if (value >= refMin && value <= refMax) status = 'in-range';
        else if ((value >= refMin * 0.9 && value < refMin) || (value > refMax && value <= refMax * 1.1)) status = 'borderline';
        else status = 'out-of-range';
      } else if (hasMax && !hasMin) {
        if (value <= refMax) status = 'in-range';
        else if (value <= refMax * 1.1) status = 'borderline';
        else status = 'out-of-range';
      } else if (hasMin && !hasMax) {
        if (value >= refMin) status = 'in-range';
        else if (value >= refMin * 0.9) status = 'borderline';
        else status = 'out-of-range';
      } else status = 'unknown';

      let referenceRange;
      const isUpperBoundOnly = refMin === 0 && refMax > 0 && refMax < 900;
      const isLowerBoundOnly = refMax >= 900;
      if (isUpperBoundOnly) referenceRange = `<${refMax}`;
      else if (isLowerBoundOnly) referenceRange = `>${refMin}`;
      else if (hasMin && hasMax) referenceRange = `${refMin}-${refMax}`;
      else referenceRange = 'N/A';

      resultsJson[bio.name] = { value, unit: bio.unit, referenceMin: refMin, referenceMax: refMax, reference_range: referenceRange, status, system: bodySystem, explanation: '' };
    });

    // STEP 7: Update test_results
    await supabase.from('test_results').update({
      status: 'completed',
      lab_name: 'SYNLAB',
      test_date: testDate || parsedData.test_date || testResult.test_date,
      results: resultsJson,
      updated_at: new Date().toISOString(),
    }).eq('id', testResult.id);

    res.json({ success: true, testResultId: testResult.id, biomarkersCount: Object.keys(resultsJson).length });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unknown error occurred', jobId });
  }
});

// ============= POST /api/delete-booking =============
app.post('/api/delete-booking', async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'Missing booking_id' });

    const { error } = await supabase
      .from('booked_tests')
      .delete()
      .eq('id', booking_id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, booking_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= POST /api/delete-test-result =============
app.post('/api/delete-test-result', async (req, res) => {
  try {
    const { test_result_id } = req.body;
    if (!test_result_id) return res.status(400).json({ error: 'Missing test_result_id' });

    // Get action_plan IDs for daily_objectives deletion
    const { data: actionPlans } = await supabase
      .from('action_plans')
      .select('id')
      .eq('test_result_id', test_result_id);
    const actionPlanIds = (actionPlans || []).map(ap => ap.id);

    // Cascade delete: daily_objectives -> action_plans -> health_summaries -> test_result
    if (actionPlanIds.length > 0) {
      await supabase.from('daily_objectives').delete().in('action_plan_id', actionPlanIds);
    }
    await supabase.from('action_plans').delete().eq('test_result_id', test_result_id);
    await supabase.from('health_summaries').delete().eq('test_result_id', test_result_id);

    const { error } = await supabase
      .from('test_results')
      .delete()
      .eq('id', test_result_id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, test_result_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
