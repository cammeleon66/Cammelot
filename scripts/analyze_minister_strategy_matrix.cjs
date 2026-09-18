const fs = require('node:fs');
const path = process.argv[2] || 'scripts/output/minister_strategy_matrix_20seeds.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const rows = data.results;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = values => { const sorted=[...values].sort((a,b)=>a-b); const middle=Math.floor(sorted.length/2); return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2; };
const range = values => [Math.min(...values), Math.max(...values)];
const round = value => Math.round(value * 100) / 100;
const groupRows = (values, selector) => values.reduce((groups, row) => {
  const key=selector(row);
  (groups[key] ||= []).push(row);
  return groups;
}, {});
const group = key => groupRows(rows, row => row[key]);
const summarize = (name, values) => ({
  name,
  runs:values.length,
  cabinetPass:values.filter(row => row.cabinetResult === 'strong' || row.cabinetResult === 'narrow').length,
  endings:Object.fromEntries(Object.entries(groupRows(values, row => row.politicalOutcome)).map(([ending, endingRows]) => [ending, endingRows.length])),
  systemDeathsMean:round(mean(values.map(row => row.care.systemDeaths))),
  systemDeathsMedian:median(values.map(row => row.care.systemDeaths)),
  systemDeathsRange:range(values.map(row => row.care.systemDeaths)),
  deathsWaitingMean:round(mean(values.map(row => row.care.deathsWaiting))),
  treatmentsMean:round(mean(values.map(row => row.care.treatments)),),
  meanWaitMean:round(mean(values.map(row => row.care.meanWait))),
  budgetMean:round(mean(values.map(row => row.budget))),
  scoreMean:round(mean(values.map(row => row.score))),
  purchasesMean:round(mean(values.map(row => row.purchases.length))),
});
const purchase = Object.entries(group('purchasePolicy')).map(([name, values]) => summarize(name, values));
const response = Object.entries(group('responsePolicy')).map(([name, values]) => summarize(name, values));
const pairs = Object.entries(groupRows(rows, row => `${row.purchasePolicy}/${row.responsePolicy}`)).map(([name, values]) => summarize(name, values));
const baseline = new Map(rows.filter(row => row.purchasePolicy === 'no-action').map(row => [`${row.seed}/${row.responsePolicy}`, row]));
const paired = purchase.filter(item => item.name !== 'no-action').map(item => {
  const values=rows.filter(row => row.purchasePolicy === item.name).map(row => ({row,base:baseline.get(`${row.seed}/${row.responsePolicy}`)}));
  return {
    purchasePolicy:item.name,
    pairs:values.length,
    deathsDifferenceMean:round(mean(values.map(({row,base}) => row.care.systemDeaths-base.care.systemDeaths))),
    deathsWaitingDifferenceMean:round(mean(values.map(({row,base}) => row.care.deathsWaiting-base.care.deathsWaiting))),
    treatmentsDifferenceMean:round(mean(values.map(({row,base}) => row.care.treatments-base.care.treatments))),
    waitDifferenceMean:round(mean(values.map(({row,base}) => row.care.meanWait-base.care.meanWait))),
    budgetDifferenceMean:round(mean(values.map(({row,base}) => row.budget-base.budget))),
    deathsBetter:values.filter(({row,base}) => row.care.systemDeaths < base.care.systemDeaths).length,
    deathsWorse:values.filter(({row,base}) => row.care.systemDeaths > base.care.systemDeaths).length,
    deathsEqual:values.filter(({row,base}) => row.care.systemDeaths === base.care.systemDeaths).length,
  };
});
const cabinetCriteria = {
  parliamentTrustBelow40:rows.filter(row => row.trust.parliament < 40).length,
  citizenTrustBelow40:rows.filter(row => row.trust.citizens < 40).length,
  doctorTrustBelow40:rows.filter(row => row.trust.doctors < 40).length,
  systemDeathsAbove4:rows.filter(row => row.care.systemDeaths > 4).length,
  parliamentTrustMaximum:Math.max(...rows.map(row => row.trust.parliament)),
};
const bestCare = [...pairs].sort((a,b)=>a.systemDeathsMean-b.systemDeathsMean||a.deathsWaitingMean-b.deathsWaitingMean||b.treatmentsMean-a.treatmentsMean||a.meanWaitMean-b.meanWaitMean).slice(0,5);
const worstCare = [...pairs].sort((a,b)=>b.systemDeathsMean-a.systemDeathsMean||b.deathsWaitingMean-a.deathsWaitingMean||a.treatmentsMean-b.treatmentsMean||b.meanWaitMean-a.meanWaitMean).slice(0,5);
const scoreVsDeaths = [...pairs].sort((a,b)=>b.scoreMean-a.scoreMean).slice(0,5).map(item=>({name:item.name,scoreMean:item.scoreMean,systemDeathsMean:item.systemDeathsMean,cabinetPass:item.cabinetPass}));
console.log(JSON.stringify({generatedAt:new Date().toISOString(),source:path,sourceGeneratedAt:data.generatedAt,seeds:data.seeds,runs:rows.length,purchase,response,paired,cabinetCriteria,bestCare,worstCare,highestScore:scoreVsDeaths},null,2));
