const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.P4_PLAYWRIGHT || 'C:/Users/Owenc/.codex/tools/mcp-node/node_modules/playwright');
const base = 'http://127.0.0.1:5314';
(async () => {
  const report = [];
  for (const channel of ['chrome','msedge']) {
    const browser = await chromium.launch({channel,headless:true});
    const run = {channel,version:browser.version(),checks:[]}; report.push(run);
    const check=(name,pass,detail)=>run.checks.push({name,pass:Boolean(pass),detail});
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const p=await context.newPage(); p.setDefaultTimeout(5000);
    try {
      await p.goto(base);
      await p.waitForFunction(()=>document.activeElement?.id==='typing-input');
      const input=p.locator('#typing-input');
      await input.evaluate(e=>e.blur());
      await p.keyboard.press('Enter');
      check('neutral Enter recovers native focus',await input.evaluate(e=>e===document.activeElement));
      await p.getByRole('button',{name:'why?',exact:true}).focus();
      await p.keyboard.press('Enter');
      check('why disclosure expands without stealing focus',await p.getByRole('button',{name:'why?',exact:true}).getAttribute('aria-expanded')==='true' && await p.getByRole('button',{name:'why?',exact:true}).evaluate(e=>e===document.activeElement));
      await p.keyboard.press('Enter');
      check('why disclosure keyboard closes',await p.getByRole('button',{name:'why?',exact:true}).getAttribute('aria-expanded')==='false');
      const menu=p.getByRole('button',{name:'menu',exact:true});
      check('narrow Menu named and exposed',await menu.count()===1 && await menu.isVisible());
      if(await menu.count()) {
        await menu.focus();await p.keyboard.press('Enter');
        check('narrow Menu keyboard opens',await menu.getAttribute('aria-expanded')==='true');
        await p.keyboard.press('Tab');
        check('narrow Menu Tab reaches practice link',await p.evaluate(()=>document.activeElement.tagName==='A'&&document.activeElement.textContent==='practice'));
        await menu.focus();await p.keyboard.press('Enter');
        check('narrow Menu keyboard closes',await menu.getAttribute('aria-expanded')==='false');
      }
      await p.locator('.skip-link').focus(); await p.keyboard.press('Enter');
      run.skipFocus=await p.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id}));
      await p.keyboard.press('Tab');
      run.afterSkipTab=await p.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,text:document.activeElement.textContent.trim().slice(0,60),insideMain:document.querySelector('#main').contains(document.activeElement),hash:location.hash}));
      check('skip link bypasses navigation on next Tab',run.afterSkipTab.hash==='#main' && run.afterSkipTab.insideMain);
      await input.focus();await p.keyboard.press('a');
      await p.keyboard.press('Tab');
      check('narrow running Tab reaches restart',await p.locator('#restart').evaluate(e=>e===document.activeElement));
      await p.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
      run.restartFocus=await p.locator('#restart').evaluate(e=>{const c=getComputedStyle(e);return {focus:e===document.activeElement,outlineStyle:c.outlineStyle,outlineWidth:c.outlineWidth,outlineColor:c.outlineColor};});
      check('forced-colors keyboard restart has outline',run.restartFocus.focus && run.restartFocus.outlineStyle!=='none' && run.restartFocus.outlineWidth!=='0px');
      fs.writeFileSync(path.join(__dirname,channel+'-narrow.aria.txt'),await p.locator('body').ariaSnapshot());
    } catch(e) {run.error=String(e.stack||e);} finally {await context.close();}
    const blocked=await browser.newContext();
    const q=await blocked.newPage();
    try {
      await q.addInitScript(()=>{
        Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Fixture denied','SecurityError');}});
      });
      await q.goto(base);
      await q.waitForFunction(()=>document.activeElement?.id==='typing-input');
      await q.keyboard.press('a');
      check('blocked preferences still allow first-key General',await q.locator('#stage').getAttribute('data-state')==='running' && await q.locator('#typing-input').inputValue()==='a');
    } catch(e){run.blockedError=String(e.stack||e);} finally {await blocked.close();await browser.close();}
  }
  fs.writeFileSync(path.join(__dirname,'accessibility-evidence.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.some(r=>r.error||r.blockedError||r.checks.some(c=>!c.pass))?1:0;
})();
