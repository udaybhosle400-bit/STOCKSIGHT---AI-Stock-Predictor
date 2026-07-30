const quantDataPipelineService = require('./services/quantDataPipelineService');
const companyRegistry = require('./config/companyRegistry');

async function testPipeline() {
  console.log('========================================================');
  console.log('🚀 TESTING QUANTITATIVE DATA PIPELINE INGESTION');
  console.log('========================================================\n');

  const testSymbols = companyRegistry.getAllSymbols();

  console.log(`Ingesting data for ${testSymbols.length} companies...`);
  const ingestionResult = await quantDataPipelineService.runFullIngestion(testSymbols);

  console.log('\n✅ Ingestion Execution Complete:');
  console.log(`- Duration: ${ingestionResult.durationMs}ms`);
  console.log(`- Processed Companies: ${ingestionResult.processedSymbols}`);

  console.log('\n--------------------------------------------------------');
  console.log('1. TESTING OHLCV DATA RETRIEVAL');
  console.log('--------------------------------------------------------');
  const ohlcv = await quantDataPipelineService.getHistoricalOHLCV('AAPL', '1mo');
  console.log(`- AAPL OHLCV Candles Retrieved: ${ohlcv.length}`);
  if (ohlcv.length > 0) {
    console.log('  Sample Candle:', ohlcv[0]);
  }

  console.log('\n--------------------------------------------------------');
  console.log('2. TESTING FUNDAMENTALS RETRIEVAL');
  console.log('--------------------------------------------------------');
  const fundamentals = await quantDataPipelineService.getFundamentals('MSFT');
  console.log('  Sample Fundamentals (MSFT):', {
    symbol: fundamentals.symbol,
    marketCap: fundamentals.marketCap,
    pe: fundamentals.pe,
    roe: fundamentals.roe,
    debtToEquity: fundamentals.debtToEquity,
    freeCashFlow: fundamentals.freeCashFlow
  });

  console.log('\n--------------------------------------------------------');
  console.log('3. TESTING FINANCIAL STATEMENTS RETRIEVAL');
  console.log('--------------------------------------------------------');
  const statements = await quantDataPipelineService.getFinancialStatements('NVDA');
  console.log(`- NVDA Financial Statements Count: ${statements.length}`);

  console.log('\n--------------------------------------------------------');
  console.log('4. TESTING MARKET OVERVIEW RETRIEVAL');
  console.log('--------------------------------------------------------');
  const market = await quantDataPipelineService.getMarketOverview();
  console.log(`- Market Indices / Assets Retrieved: ${market.length}`);
  console.log('  Sample Market Asset:', market[0]);

  console.log('\n--------------------------------------------------------');
  console.log('5. TESTING INSTITUTIONAL NEWS RETRIEVAL');
  console.log('--------------------------------------------------------');
  const news = await quantDataPipelineService.getNews('TSLA');
  console.log(`- TSLA Headlines Retrieved: ${news.length}`);
  if (news.length > 0) {
    console.log('  Sample Headline:', news[0].headline);
  }

  console.log('\n--------------------------------------------------------');
  console.log('6. PIPELINE HEALTH & INGESTION STATISTICS');
  console.log('--------------------------------------------------------');
  const status = quantDataPipelineService.getPipelineStatus();
  console.log(JSON.stringify(status, null, 2));

  console.log('\n========================================================');
  console.log('🎉 QUANTITATIVE DATA PIPELINE TEST SUCCESSFUL!');
  console.log('========================================================');
}

testPipeline().catch(err => {
  console.error('❌ Pipeline Test Failed:', err);
  process.exit(1);
});
