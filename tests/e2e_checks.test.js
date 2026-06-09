// E2E Infrastructure Checks — Sprint 11
// Validates that all required project files and configurations exist

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('E2E Simulation Checks', () => {
  it('should define all required DISEASE_DB entries in world.html', () => {
    // Actual ICD-10 codes in the simulation's DISEASE_DB
    const expectedCodes = ['I25','E11','J44','F03','M17','M81','I50','C34','F32','I10'];
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    for (const code of expectedCodes) {
      assert.ok(world.includes("'" + code + "'"), `DISEASE_DB should reference ${code}`);
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

  it('should have world.html with Sprint 11 QA features', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('QA_CHECKS'), 'QA_CHECKS array defined');
    assert.ok(world.includes('runQAChecks'), 'runQAChecks function defined');
    assert.ok(world.includes('BIAS_DATA'), 'BIAS_DATA object defined');
    assert.ok(world.includes('trackBiasData'), 'trackBiasData function defined');
    assert.ok(world.includes('exportSimData'), 'exportSimData function defined');
    assert.ok(world.includes('buildROIHTML'), 'buildROIHTML function defined');
    assert.ok(world.includes('buildComparisonHTML'), 'buildComparisonHTML function defined');
  });

  // ── Sprint S2: Admin Tax Features ──
  it('should have admin taxi meter in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('drawAdminTaxiMeter'), 'Admin taxi meter exists');
    assert.ok(world.includes('taxiMeterVisible'), 'Taxi meter toggle exists');
  });

  it('should have C_eff capacity chart in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('buildCapacityChart'), 'C_eff chart exists');
  });

  it('should have GP sick leave mechanic in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('sickLeaveTimer'), 'Sick leave timer exists');
  });

  // ── Sprint S3: Wait List Features ──
  it('should have age bias chart in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('drawAgeBiasChart') || world.includes('age-bias-canvas'), 'Age bias chart exists');
  });

  it('should have HP drain breakdown in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('buildDrainBreakdown'), 'HP drain breakdown exists');
  });

  it('should track Treeknorm violations in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('treeknorm_violation'), 'Treeknorm violation event type exists');
    assert.ok(world.includes('showTreeknormLog'), 'Treeknorm log panel exists');
  });

  // ── Sprint S6: Security Hardening + Methodology Panel ──
  it('should have text sanitization in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('sanitizeText'), 'Text sanitization function exists');
  });

  it('should have save schema validation in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('validateSaveSchema'), 'Save schema validation exists');
  });

  it('should have methodology panel in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('showMethodology'), 'Methodology panel exists');
  });

  // ── Sprint S4: Does AI Make Inequality Worse? ──
  it('should have Gini coefficient in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('calculateGiniCoefficient') || world.includes('calculateGini'), 'Gini calculation exists');
    assert.ok(world.includes('giniHistory'), 'Gini history tracking exists');
  });

  it('should have bias score tracking in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('biasScoreHistory') || world.includes('compositeBias'), 'Bias score history exists');
  });

  it('should have digital literacy in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('digitalLiteracy'), 'Digital literacy attribute exists');
  });

  // ── Sprint S5: Digital Twin Panel ──
  it('should have Digital Twin panel in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('buildDigitalTwinPanel'), 'Digital Twin panel exists');
  });

  // ── Sprint S5: Proactive Alert Visualization ──
  it('should have proactive alert visualization in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('proactiveAlertCount'), 'Proactive alert counter exists');
  });

  // ── Sprint S5: ER Pressure Chart ──
  it('should have ER pressure chart in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('buildERPressureHTML') || world.includes('erPressure') || world.includes('HOSPITAL_DAY_COST'), 'ER pressure comparison exists');
  });

  // ── Sprint S6: Screenshot Mode ──
  it('should have screenshot mode in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('screenshotMode'), 'Screenshot mode exists');
  });

  // ── Sprint 23: Insight Engine ──
  it('should have Insight Engine in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('INSIGHT_LOG'), 'INSIGHT_LOG array defined');
    assert.ok(world.includes('INSIGHT_FIRED'), 'INSIGHT_FIRED tracking object defined');
    assert.ok(world.includes('runInsightEngine'), 'runInsightEngine function defined');
    assert.ok(world.includes('addInsight'), 'addInsight function defined');
    assert.ok(world.includes('showInsightsPanel'), 'showInsightsPanel function defined');
    assert.ok(world.includes('first_death'), 'First death insight type exists');
    assert.ok(world.includes('all_gps_burnout'), 'All GPs burnout insight type exists');
    assert.ok(world.includes('age_bias'), 'Age bias insight type exists');
    assert.ok(world.includes('queue_record'), 'Queue record insight type exists');
  });

  // ── Sprint 23: Weekly Report Generator ──
  it('should have Weekly Report Generator in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('WEEKLY_REPORTS'), 'WEEKLY_REPORTS array defined');
    assert.ok(world.includes('generateWeeklyReport'), 'generateWeeklyReport function defined');
    assert.ok(world.includes('showWeeklyReport'), 'showWeeklyReport function defined');
    assert.ok(world.includes('lastWeeklyReportCycle'), 'lastWeeklyReportCycle tracker defined');
    assert.ok(world.includes('deathsByAge'), 'Deaths by age group breakdown');
    assert.ok(world.includes('deathsByCondition'), 'Deaths by condition breakdown');
    assert.ok(world.includes('treeknormViolations'), 'Treeknorm violations count in report');
    assert.ok(world.includes('savingsPotential'), 'Savings potential in financial section');
    assert.ok(world.includes('EQUITY CHECK'), 'Bias/equity check section in report');
  });

  // ── Sprint 23: Provider Burnout Cascade ──
  it('should have Provider Burnout Cascade in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('processBurnoutCascade'), 'processBurnoutCascade function defined');
    assert.ok(world.includes('incrementBurnoutForPatient'), 'incrementBurnoutForPatient function defined');
    assert.ok(world.includes('burnoutCascadeSickLeave'), 'Burnout cascade sick leave flag exists');
    assert.ok(world.includes('_systemOverload'), 'System overload flag exists');
    assert.ok(world.includes('System Overload'), 'System Overload ticker message exists');
    assert.ok(world.includes('burnout cascade'), 'Burnout cascade messaging exists');
  });

  // ── Sprint 23: Burnout visual effects ──
  it('should have burnout visual effects in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('burnEmoji'), 'Burnout emoji indicator exists');
    assert.ok(world.includes('GP Burnout visual'), 'GP burnout visual comment exists');
    assert.ok(world.includes('Burned out GPs walk slower'), 'GP burnout speed reduction exists');
  });

  // ── Sprint 26.3: Embed Widget Mode ──
  it('should have embed mode in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('EMBED_MODE'), 'Embed mode detection exists');
    assert.ok(world.includes('embed=true'), 'Embed URL parameter check exists');
    assert.ok(world.includes('cammelot') && world.includes('watermark'), 'Watermark exists');
  });

  // ── Sprint 28.2: Emergent Social Dynamics ──
  it('should have emergent social dynamics in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('grievingTimer'), 'Grieving mechanic exists');
    assert.ok(world.includes('isProtesting'), 'Protest mechanic exists');
    assert.ok(world.includes('word-of-mouth') || world.includes('wordOfMouth') || world.includes('shareExperience'), 'Word-of-mouth exists');
  });

  // ── Sprint 28.1: Agent Memory & Personality ──
  it('should have agent memory system in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('addMemory'), 'addMemory function exists');
    assert.ok(world.includes('personality'), 'personality attribute exists');
    assert.ok(world.includes('PERSONALITY_TRAITS'), 'PERSONALITY_TRAITS constant exists');
    assert.ok(world.includes('getPersonalityTrait'), 'getPersonalityTrait function exists');
    assert.ok(world.includes('getMemoryDialogue'), 'getMemoryDialogue function exists');
    assert.ok(world.includes('MAX_MEMORIES'), 'MAX_MEMORIES constant exists');
  });

  // ── Blog-Ready Sprint: Gini Timeline Chart ──
  it('should have Gini timeline canvas chart in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('gini-timeline-canvas'), 'Gini timeline canvas element exists');
  });

  // ── Blog-Ready Sprint: Ketenzorg Tracking ──
  it('should have Ketenzorg intervention tracking in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('ketenzorgInterventions'), 'Ketenzorg interventions counter exists');
  });

  // ── Blog-Ready Sprint: ER Admission Counter ──
  it('should have ER admission counter in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('erAdmissionCount'), 'ER admission counter exists');
  });

  // ── Blog-Ready Sprint: Digital Twin Alert Toast ──
  it('should have Digital Twin alert toast in world.html', () => {
    const world = fs.readFileSync(path.join(ROOT, 'site', 'world.html'), 'utf8');
    assert.ok(world.includes('Digital Twin Alert'), 'Digital Twin Alert toast exists');
  });
});
