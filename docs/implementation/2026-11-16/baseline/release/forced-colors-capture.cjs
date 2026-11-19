const fs = require('node:fs');
const path = require('node:path');
const {chromium}=require(process.env.P4_PLAYWRIGHT || 'C:/Users/Owenc/.codex/tools/mcp-node/node_modules/playwright');
(async()=>{
  const report=[];
  for(const channel of ['chrome','msedge']) {
    const browser=await chromium.launch({channel,headless:true});
    const context=await browser.newContext({forcedColors:'active'});
    const p=await context.newPage();
    const run={channel,version:browser.version()};report.push(run);
    try {
      await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));
      await p.goto('http://127.0.0.1:5314');
      const input=p.locator('#typing-input');
      await p.waitForFunction(()=>document.activeElement?.id==='typing-input');
      const prompt=(await p.locator('#target-description').innerText()).replace('Passage to copy: ','');
      await input.pressSequentially(prompt.slice(0,5));
      await input.press(prompt[5]==='x'?'z':'x');
      run.input=await input.inputValue();run.prompt=prompt;
      run.correction=await p.locator('#typing-help').innerText();
      run.promptStyles=await p.locator('#prompt span').evaluateAll(es=>es.map(e=>{const c=getComputedStyle(e);return {text:e.textContent,class:e.className,color:c.color,background:c.backgroundColor,decoration:c.textDecorationLine};}));
      await p.screenshot({path:path.join(__dirname,channel+'-forced-typed.png')});
      await input.press('Tab');
      run.focus=await p.evaluate(()=>({id:document.activeElement.id,outline:getComputedStyle(document.activeElement).outline}));
      await p.screenshot({path:path.join(__dirname,channel+'-forced-key-focus.png')});
      await p.locator('body').click({position:{x:5,y:500}});
      run.coverVisible=await p.locator('#continue-typing').isVisible();
      await p.screenshot({path:path.join(__dirname,channel+'-forced-cover.png')});
      await p.locator('#restart').click();
      await p.waitForFunction(()=>document.querySelector('#stage').dataset.state==='idle');
      await p.locator('#duration ui-segmented-control-item[value="60"]').focus();await p.keyboard.press('Space');
      await p.locator('#qwerty').focus();await p.keyboard.press('Space');
      run.settings=await p.locator('#duration ui-segmented-control-item, #qwerty').evaluateAll(es=>es.map(e=>{const c=getComputedStyle(e);return {text:e.textContent.trim(),checked:e.hasAttribute('data-checked'),color:c.color,background:c.backgroundColor,border:c.border,decoration:c.textDecorationLine};}));
    } finally {await context.close();await browser.close();}
  }
  fs.writeFileSync(path.join(__dirname,'forced-colors-evidence.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.map(r=>({channel:r.channel,version:r.version,focus:r.focus,coverVisible:r.coverVisible})),null,2));
})();
