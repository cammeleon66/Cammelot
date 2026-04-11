// E2E Infrastructure Checks — Sprint 11
// Validates that all required project files and configurations exist

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('E2E Simulation Checks', () => {
  it('should define all required DISEASE_DB entries in v4.html', () => {
    // Actual ICD-10 codes in the simulation's DISEASE_DB
    const expectedCodes = ['I25','E11','J44','F03','M17','M81','I50','C34','F32','I10'];
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    for (const code of expectedCodes) {
      assert.ok(v4.includes("'" + code + "'"), `DISEASE_DB should reference ${code}`);
    }
  });

  it('should have CI pipeline configured', () => {
    assert.ok(fs.existsSync(path.join(ROOT, '.github', 'workflows', 'ci.yml')), 'CI config exists');
  });

  it('should have Docker configuration', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'Dockerfile')), 'Dockerfile exists');
    assert.ok(fs.existsSync(path.join(ROOT, 'docker-compose.yml')), 'docker-compose exists');
  });

  it('should have landing page', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'src', 'frontend', 'index.html')), 'Landing page exists');
  });

  it('should have nginx config with security headers', () => {
    const nginx = fs.readFileSync(path.join(ROOT, 'nginx.conf'), 'utf8');
    assert.ok(nginx.includes('Content-Security-Policy'), 'CSP header configured');
    assert.ok(nginx.includes('X-Frame-Options'), 'X-Frame-Options configured');
  });

  it('should have v4.html with Sprint 11 QA features', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('QA_CHECKS'), 'QA_CHECKS array defined');
    assert.ok(v4.includes('runQAChecks'), 'runQAChecks function defined');
    assert.ok(v4.includes('BIAS_DATA'), 'BIAS_DATA object defined');
    assert.ok(v4.includes('trackBiasData'), 'trackBiasData function defined');
    assert.ok(v4.includes('exportSimData'), 'exportSimData function defined');
    assert.ok(v4.includes('buildROIHTML'), 'buildROIHTML function defined');
    assert.ok(v4.includes('buildComparisonHTML'), 'buildComparisonHTML function defined');
  });

  // ── Sprint S2: Admin Tax Features ──
  it('should have admin taxi meter in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('drawAdminTaxiMeter'), 'Admin taxi meter exists');
    assert.ok(v4.includes('taxiMeterVisible'), 'Taxi meter toggle exists');
  });

  it('should have C_eff capacity chart in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('buildCapacityChart'), 'C_eff chart exists');
  });

  it('should have GP sick leave mechanic in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('sickLeaveTimer'), 'Sick leave timer exists');
  });

  // ── Sprint S3: Wait List Features ──
  it('should have age bias chart in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('drawAgeBiasChart') || v4.includes('age-bias-canvas'), 'Age bias chart exists');
  });

  it('should have HP drain breakdown in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('buildDrainBreakdown'), 'HP drain breakdown exists');
  });

  it('should track Treeknorm violations in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('treeknorm_violation'), 'Treeknorm violation event type exists');
    assert.ok(v4.includes('showTreeknormLog'), 'Treeknorm log panel exists');
  });

  // ── Sprint S6: Security Hardening + Methodology Panel ──
  it('should have text sanitization in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('sanitizeText'), 'Text sanitization function exists');
  });

  it('should have save schema validation in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('validateSaveSchema'), 'Save schema validation exists');
  });

  it('should have methodology panel in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('showMethodology'), 'Methodology panel exists');
  });

  // ── Sprint S4: Does AI Make Inequality Worse? ──
  it('should have Gini coefficient in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('calculateGiniCoefficient') || v4.includes('calculateGini'), 'Gini calculation exists');
    assert.ok(v4.includes('giniHistory'), 'Gini history tracking exists');
  });

  it('should have bias score tracking in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('biasScoreHistory') || v4.includes('compositeBias'), 'Bias score history exists');
  });

  it('should have digital literacy in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('digitalLiteracy'), 'Digital literacy attribute exists');
  });

  // ── Sprint S5: Digital Twin Panel ──
  it('should have Digital Twin panel in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('buildDigitalTwinPanel'), 'Digital Twin panel exists');
  });

  // ── Sprint S5: Proactive Alert Visualization ──
  it('should have proactive alert visualization in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('proactiveAlertCount'), 'Proactive alert counter exists');
  });

  // ── Sprint S5: ER Pressure Chart ──
  it('should have ER pressure chart in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('buildERPressureHTML') || v4.includes('erPressure') || v4.includes('HOSPITAL_DAY_COST'), 'ER pressure comparison exists');
  });

  // ── Sprint S6: Screenshot Mode ──
  it('should have screenshot mode in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('screenshotMode'), 'Screenshot mode exists');
  });

  // ── Sprint 23: Insight Engine ──
  it('should have Insight Engine in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('INSIGHT_LOG'), 'INSIGHT_LOG array defined');
    assert.ok(v4.includes('INSIGHT_FIRED'), 'INSIGHT_FIRED tracking object defined');
    assert.ok(v4.includes('runInsightEngine'), 'runInsightEngine function defined');
    assert.ok(v4.includes('addInsight'), 'addInsight function defined');
    assert.ok(v4.includes('showInsightsPanel'), 'showInsightsPanel function defined');
    assert.ok(v4.includes('first_death'), 'First death insight type exists');
    assert.ok(v4.includes('all_gps_burnout'), 'All GPs burnout insight type exists');
    assert.ok(v4.includes('age_bias'), 'Age bias insight type exists');
    assert.ok(v4.includes('queue_record'), 'Queue record insight type exists');
  });

  // ── Sprint 23: Weekly Report Generator ──
  it('should have Weekly Report Generator in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('WEEKLY_REPORTS'), 'WEEKLY_REPORTS array defined');
    assert.ok(v4.includes('generateWeeklyReport'), 'generateWeeklyReport function defined');
    assert.ok(v4.includes('showWeeklyReport'), 'showWeeklyReport function defined');
    assert.ok(v4.includes('lastWeeklyReportCycle'), 'lastWeeklyReportCycle tracker defined');
    assert.ok(v4.includes('deathsByAge'), 'Deaths by age group breakdown');
    assert.ok(v4.includes('deathsByCondition'), 'Deaths by condition breakdown');
    assert.ok(v4.includes('treeknormViolations'), 'Treeknorm violations count in report');
    assert.ok(v4.includes('savingsPotential'), 'Savings potential in financial section');
    assert.ok(v4.includes('EQUITY CHECK'), 'Bias/equity check section in report');
  });

  // ── Sprint 23: Provider Burnout Cascade ──
  it('should have Provider Burnout Cascade in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('processBurnoutCascade'), 'processBurnoutCascade function defined');
    assert.ok(v4.includes('incrementBurnoutForPatient'), 'incrementBurnoutForPatient function defined');
    assert.ok(v4.includes('burnoutCascadeSickLeave'), 'Burnout cascade sick leave flag exists');
    assert.ok(v4.includes('_systemOverload'), 'System overload flag exists');
    assert.ok(v4.includes('System Overload'), 'System Overload ticker message exists');
    assert.ok(v4.includes('burnout cascade'), 'Burnout cascade messaging exists');
  });

  // ── Sprint 23: Burnout visual effects ──
  it('should have burnout visual effects in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('burnEmoji'), 'Burnout emoji indicator exists');
    assert.ok(v4.includes('GP Burnout visual'), 'GP burnout visual comment exists');
    assert.ok(v4.includes('Burned out GPs walk slower'), 'GP burnout speed reduction exists');
  });

  // ── Sprint 26.3: Embed Widget Mode ──
  it('should have embed mode in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('EMBED_MODE'), 'Embed mode detection exists');
    assert.ok(v4.includes('embed=true'), 'Embed URL parameter check exists');
    assert.ok(v4.includes('cammelot') && v4.includes('watermark'), 'Watermark exists');
  });

  // ── Sprint 28.2: Emergent Social Dynamics ──
  it('should have emergent social dynamics in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('grievingTimer'), 'Grieving mechanic exists');
    assert.ok(v4.includes('isProtesting'), 'Protest mechanic exists');
    assert.ok(v4.includes('word-of-mouth') || v4.includes('wordOfMouth') || v4.includes('shareExperience'), 'Word-of-mouth exists');
  });

  // ── Sprint 28.1: Agent Memory & Personality ──
  it('should have agent memory system in v4.html', () => {
    const v4 = fs.readFileSync(path.join(ROOT, 'src', 'frontend', 'v4.html'), 'utf8');
    assert.ok(v4.includes('addMemory'), 'addMemory function exists');
    assert.ok(v4.includes('personality'), 'personality attribute exists');
    assert.ok(v4.includes('PERSONALITY_TRAITS'), 'PERSONALITY_TRAITS constant exists');
    assert.ok(v4.includes('getPersonalityTrait'), 'getPersonalityTrait function exists');
    assert.ok(v4.includes('getMemoryDialogue'), 'getMemoryDialogue function exists');
    assert.ok(v4.includes('MAX_MEMORIES'), 'MAX_MEMORIES constant exists');
  });
});
