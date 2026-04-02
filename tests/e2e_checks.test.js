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
});
