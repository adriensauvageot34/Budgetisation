// Operates the visible carousel/popover controls; never modifies React or semantic state.
export function inventoryNavigator(run, evaluate) {
  return selector => {
    const info = evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const page=el.closest('[data-board-page]'),pop=el.closest('[popover]');return {page:page?Number(page.dataset.boardPage):null,pop:pop&&!pop.matches(':popover-open')?pop.id:null,dragging:document.querySelector('[data-composer]')?.dataset.dragging==='true'}})()`);
    if (!info) return;
    if (info.page !== null) {
      let active = evaluate('Number(document.querySelector("[data-board-page-active]").dataset.boardPageActive)');
      if (active !== info.page && !info.dragging) { run('click', `[data-page-index="${info.page}"]`); run('wait','240'); }
      while (active !== info.page && info.dragging) {
        const direction = info.page > active ? 'next' : 'previous';
        const rect = evaluate(`document.querySelector('[data-board-edge="${direction}"]').getBoundingClientRect().toJSON()`);
        run('mouse','move',String(Math.round(rect.x+rect.width/2)),String(Math.round(rect.y+rect.height/2)));
        run('wait','850');
        const next = evaluate('Number(document.querySelector("[data-board-page-active]").dataset.boardPageActive)');
        if (next === active) throw new Error(`Carousel did not advance during drag: ${selector}`);
        active = next;
        const board = evaluate('document.querySelector("[data-board-scroll]").getBoundingClientRect().toJSON()');
        run('mouse','move',String(Math.round(board.x+board.width/2)),String(Math.round(board.y+12)));
      }
    }
    if (info.pop) { run('click', `button[aria-controls="${info.pop}"]`); run('wait','50'); }
  };
}
