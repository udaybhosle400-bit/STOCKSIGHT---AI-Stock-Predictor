const featureEngineeringService = require('./services/featureEngineeringService');
const featureModel = require('./models/featureModel');
const companyRegistry = require('./config/companyRegistry');

async function runFeatureEngineeringTest() {
  console.log('========================================================');
  console.log('🚀 TESTING QUANTITATIVE FEATURE ENGINEERING ENGINE (PHASE 14)');
  console.log('========================================================\n');

  const allSymbols = companyRegistry.getAllSymbols();
  console.log(`Master Registry Companies: ${allSymbols.length}`);

  console.log(`Generating engineered features across all ${allSymbols.length} companies...`);
  const result = await featureEngineeringService.generateAllFeatures(allSymbols);

  console.log('\n✅ Feature Generation Complete:');
  console.log(`- Execution Duration: ${result.durationMs}ms`);
  console.log(`- Processed Companies: ${result.processedCompanies}`);
  console.log(`- Total Saved Feature Records: ${result.totalSavedRecords}`);
  console.log(`- Failed Companies: ${result.failedCompanies}`);
  console.log(`- Skipped Companies: ${result.skippedCompanies}`);

  console.log('\n--------------------------------------------------------');
  console.log('1. TESTING FEATURE SNAPSHOT RETRIEVAL (AAPL)');
  console.log('--------------------------------------------------------');
  const aaplFeatures = await featureModel.getLatestFeatures('AAPL');
  console.log(`- Total Features for AAPL: ${aaplFeatures.totalFeatures}`);
  console.log('  Sample Technical Features (RSI, MACD, SMA20):', {
    rsi_14: aaplFeatures.featureMap['rsi_14'],
    macd_line: aaplFeatures.featureMap['macd_line'],
    sma_20: aaplFeatures.featureMap['sma_20'],
    bb_upper: aaplFeatures.featureMap['bb_upper']
  });
  console.log('  Sample Fundamental Features (PE, ROE, Debt/Equity):', {
    pe_ratio: aaplFeatures.featureMap['pe_ratio'],
    roe: aaplFeatures.featureMap['roe'],
    debt_to_equity: aaplFeatures.featureMap['debt_to_equity']
  });

  console.log('\n--------------------------------------------------------');
  console.log('2. TESTING FEATURE SNAPSHOT RETRIEVAL (RELIANCE.NS)');
  console.log('--------------------------------------------------------');
  const relFeatures = await featureModel.getLatestFeatures('RELIANCE.NS');
  console.log(`- Total Features for RELIANCE.NS: ${relFeatures.totalFeatures}`);
  console.log('  Sample Price & Volume Features:', {
    daily_return: relFeatures.featureMap['daily_return'],
    rolling_volatility_20: relFeatures.featureMap['rolling_volatility_20'],
    volume_spike: relFeatures.featureMap['volume_spike'],
    mfi_14: relFeatures.featureMap['mfi_14']
  });
  console.log('  Sample Market Relative Features:', {
    rel_strength_nifty: relFeatures.featureMap['rel_strength_nifty'],
    market_momentum: relFeatures.featureMap['market_momentum']
  });

  console.log('\n--------------------------------------------------------');
  console.log('3. FEATURE STORE HEALTH & MONITORING STATS');
  console.log('--------------------------------------------------------');
  const stats = await featureModel.getFeatureStats();
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n========================================================');
  console.log('🎉 QUANTITATIVE FEATURE ENGINEERING ENGINE TEST SUCCESSFUL!');
  console.log('========================================================\n');
}

runFeatureEngineeringTest().catch(err => {
  console.error('❌ Feature Engineering Test Failed:', err);
  process.exit(1);
});
