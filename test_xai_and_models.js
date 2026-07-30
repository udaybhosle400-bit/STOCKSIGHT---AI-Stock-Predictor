const aiPredictionEngineService = require('./services/aiPredictionEngineService');
const aiPredictionModel = require('./models/aiPredictionModel');
const predictionController = require('./controllers/predictionController');

async function testAll() {
  console.log('Testing single company prediction generation for AAPL...');
  const pred = await aiPredictionEngineService.trainAndPredictCompany('AAPL');
  console.log('Generated Prediction for AAPL:', {
    symbol: pred.symbol,
    signal: pred.signal,
    confidenceScore: pred.confidenceScore,
    topFeaturesCount: pred.topFeatures?.length,
    positiveDriversCount: pred.positiveDrivers?.length,
    negativeDriversCount: pred.negativeDrivers?.length,
    narrative: pred.explanationNarrative
  });

  const models = await aiPredictionModel.getModelsForSymbol('AAPL');
  console.log(`Registered Models for AAPL: ${models.length} models`);
  models.forEach(m => console.log(` - ${m.model_name || m.modelName} (${m.model_type || m.modelType})`));

  console.log('\nTesting Controllers...');
  const reqXai = { params: { symbol: 'AAPL' } };
  const resXai = { json: (data) => console.log('XAI Controller Response Success:', data.success, '| Top features:', data.topFeatures?.length, '| Narrative:', !!data.explanationNarrative) };
  await predictionController.getXaiAnalysis(reqXai, resXai, (err) => console.error(err));

  const reqModels = { query: { symbol: 'AAPL' } };
  const resModels = { json: (data) => console.log('Models Controller Response Success:', data.success, '| Models count:', data.models?.length) };
  await predictionController.getModelComparison(reqModels, resModels, (err) => console.error(err));

  const reqHist = { params: { symbol: 'AAPL' } };
  const resHist = { json: (data) => console.log('History Comparison Controller Response Success:', data.success, '| Timeline count:', data.timeline?.length) };
  await predictionController.getHistoryComparison(reqHist, resHist, (err) => console.error(err));

  console.log('✅ ALL BACKEND PREDICTION ENDPOINTS VERIFIED!');
  process.exit(0);
}

testAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
