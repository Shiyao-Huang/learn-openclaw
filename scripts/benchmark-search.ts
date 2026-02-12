#!/usr/bin/env tsx
import { McpClient } from '../skills/mcporter/client.js';

async function main() {
  const client = new McpClient();
  await client.start();

  console.log('=== 搜索 SWE-Bench ===');
  const swe = await client.call('web-search-prime', 'webSearchPrime', { 
    query: 'SWE-Bench benchmark LLM agent software engineering evaluation 2024' 
  });
  console.log(JSON.stringify(swe, null, 2));

  console.log('\n=== 搜索 Memory Benchmark ===');
  const mem = await client.call('web-search-prime', 'webSearchPrime', { 
    query: 'LLM agent memory benchmark MemGPT evaluation 2024' 
  });
  console.log(JSON.stringify(mem, null, 2));

  console.log('\n=== 搜索 BL Benchmark ===');
  const bl = await client.call('web-search-prime', 'webSearchPrime', { 
    query: 'BL benchmark "yaoshunyu" OR "browser live" agent evaluation framework' 
  });
  console.log(JSON.stringify(bl, null, 2));

  await client.stop();
}

main().catch(console.error);
