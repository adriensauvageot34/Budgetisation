import { require } from '../lib/phase2-ts-loader.mjs';
import { monthFixture } from './composer-v22-b1.mjs';
import { component, control, findSlot, rebuild, uuid, householdId } from './planner-headless.mjs';

const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { plannerDigest } = require('@/domain/phase2/planner/json');
export const impactIds = { groceries: uuid(27001), amazon: uuid(27002), restaurant: uuid(27003), cinema: uuid(27004),
  weekend: uuid(27005), clothing: uuid(27006), mascara: uuid(27007) };

export async function budgetImpactFixture({ coverage = 'CONFIRMED_CONSUMPTION', groceriesAmount = null, envelope = true, monthlyDeclarations = true } = {}) {
  const fixture = monthFixture();
  const slot = findSlot(fixture.world, 'groceries') ?? fixture.world.baseline.slots.find(row => row.semanticKey === 'groceries');
  if (!envelope) {
    fixture.world.sources.food = { ...fixture.world.sources.food, months: [] };
    fixture.world.forecast.referencePlan.necessary = fixture.world.forecast.referencePlan.necessary.filter(part => part.key !== 'groceries');
    fixture.world.sources.forecast = fixture.world.forecast;
  }
  if (!monthlyDeclarations) {
    fixture.world.monthInputs.declaredResources = {};
    fixture.world.monthInputs.benefit = { currentBalance: null, expectedLoading: null };
    for (const wallet of Object.values(fixture.world.monthInputs.benefitWallets ?? {})) wallet.expectedLoading = null;
  }
  rebuild(fixture.world);
  let draft = { ...fixture.semantic, controls: groceriesAmount === null ? []
    : [control(slot.slotIdentityKey, { amount: groceriesAmount }, 27000)] };
  let sequence = 0;
  async function request(operation = { kind: 'READ' }) {
    const response = await handleComposerRequest(fixture.deps, householdId, { sequence: ++sequence, targetMonth: draft.targetMonth, draft, ...operation });
    if (!response.ok) throw new Error(`${operation.kind}: ${response.code} · ${response.message}`);
    draft = response.model.semanticState;
    return response.model;
  }
  const add = (id, template, preset, basket = false) => request({ kind: 'DROP', assetKey: `template:${template}`, target: { kind: 'BOARD_ZONE' },
    identity: id, selectionId: crypto.randomUUID(), values: {}, presetKey: preset, ...(basket ? { purchaseBasket: true } : {}) });
  const basketEdit = (id, change) => request({ kind: 'EDIT_PURCHASE_BASKET', edit: { contextOccurrenceId: id,
    expectedContextDigest: plannerDigest(draft.contexts.find(context => context.contextOccurrenceId === id)), change } });
  const line = (id, n, label, quantity, price) => basketEdit(id, { kind: 'SAVE_ITEM', selectionId: uuid(n), label, quantity, price, unit: 'UNIT' });
  const selection = (option, n, label, amount, fields = {}) => component(option, amount, uuid(n), { label, ...fields });

  await add(impactIds.groceries, 'purchase', 'groceries-purchase');
  await line(impactIds.groceries, 27101, 'Pâtes', '2', '1,50');
  await line(impactIds.groceries, 27102, 'Lait', '3', '1,20');
  await line(impactIds.groceries, 27103, 'Pain', '1', '1,40');
  await basketEdit(impactIds.groceries, { kind: 'SET_DELIVERY', mode: 'IN_STORE', coverage: 'FREE' });
  await basketEdit(impactIds.groceries, { kind: 'SET_DETAILS', merchant: '', date: '', coverage });

  await add(impactIds.amazon, 'purchase', 'amazon-purchase', true);
  await line(impactIds.amazon, 27201, 'Mascara', '1', '12');
  await line(impactIds.amazon, 27202, 'Shampoing', '2', '8');
  await line(impactIds.amazon, 27203, 'T-shirt', '1', '20');
  await basketEdit(impactIds.amazon, { kind: 'SET_DELIVERY', mode: 'DELIVERY', coverage: 'INCLUDED' });

  await add(impactIds.restaurant, 'restaurant', 'restaurant-for-two');
  const meal = selection('restaurant', 27301, 'Addition', '40.00', {
    binding: { mode: 'NO_RELATED_SLOT' }, fundingAllocations: [{ source: 'BANK', amount: '40.00' }] });
  await request({ kind: 'EDIT_RESTAURANT', edit: { contextOccurrenceId: impactIds.restaurant, slots: { meal: [meal] } } });
  await request({ kind: 'EDIT_RESTAURANT', edit: { contextOccurrenceId: impactIds.restaurant, includedDetails: {
    version: 'restaurant-included-details@v1', mealSelectionId: meal.selectionId, items: [
      { detailId: uuid(27302), label: 'Bière comprise', included: true, quantity: null, unitBasis: null,
        amount: { kind: 'DECLARED_LINE_TOTAL', value: '6.00' }, provenance: 'EXPLICIT_USER_DECISION' },
    ],
  } } });

  await add(impactIds.cinema, 'activity', 'cinema');
  await request({ kind: 'EDIT_PRESET_CONTEXT', edit: { contextOccurrenceId: impactIds.cinema, slots: {
    main: [selection('activity', 27401, 'Billet', '12.00')], extras: [selection('extra', 27402, 'Popcorn', '4.00')],
  } } });

  await add(impactIds.weekend, 'short-stay', 'weekend-gite');
  await request({ kind: 'EDIT_SHORT_STAY', edit: { contextOccurrenceId: impactIds.weekend, fields: { nightCount: 2, lodgingKind: 'HOTEL' }, slots: {
    lodging: [selection('lodging', 27501, 'Forfait hébergement avec petit-déjeuner', '200.00',
      { unitBasis: 'ITEM', lodgingPricing: { version: 'lodging-pricing@v1', basis: 'TOTAL', nightCount: 2 } })],
    extras: [selection('extra', 27502, 'Taxe de séjour distincte', '8.00')],
  } } });

  await add(impactIds.clothing, 'purchase', 'clothing-shopping', true);
  await line(impactIds.clothing, 27601, 'Vêtement à chiffrer', '1', '');
  await basketEdit(impactIds.clothing, { kind: 'SET_DELIVERY', mode: 'IN_STORE', coverage: 'FREE' });

  await add(impactIds.mascara, 'beauty-restock', 'mascara');
  await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: impactIds.mascara, slotKey: 'products',
    items: [selection('product', 27701, 'Mascara', '12.50')] } });

  return { ...fixture, draft, model: await request(), request, basketEdit, line };
}
