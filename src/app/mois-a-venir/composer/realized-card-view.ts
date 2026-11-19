import type { RealizedCard, RealizedPayment } from "@/server/phase2/planner/realized-month";

export type RealizedCardView = Readonly<{
  card: RealizedCard;
  source: RealizedCard;
  operation?: RealizedPayment;
}>;

export function realizedOperationCardId(paymentId: string) {
  return `payment-${paymentId}`;
}

/** Every bank operation has one visible owner. A multi-payment event retains
 * its date, places and trip, and links to the individual amounts. */
export function detailedRealizedCards(source: RealizedCard): RealizedCardView[] {
  if (source.work) return [{ source, card: source }];
  const datedEvent = source.section === "events" && Boolean(source.date);
  if (datedEvent && source.payments.length <= 1) return [{ source, card: source }];
  if (source.payments.length) {
    const operations = source.payments.map(operation => ({
      source, operation,
      card: {
        id: realizedOperationCardId(operation.id),
        section: source.section,
        label: operation.label,
        art: operation.art ?? source.art,
        date: operation.date,
        places: operation.place ? [operation.place] : [],
        payments: [operation],
        amount: operation.amount,
      } satisfies RealizedCard,
    }));
    if (!datedEvent) return operations;
    return [{
      source,
      card: {
        ...source, amount: null, payments: [],
        relatedPayments: [...(source.relatedPayments ?? []), ...source.payments.map(payment => ({
          id: payment.id, label: payment.label, date: payment.date, cardId: source.id, cardLabel: source.label,
        }))],
      },
    }, ...operations];
  }
  if (!source.occurrences?.length) return [{ source, card: source }];
  return source.occurrences.map(occurrence => ({
    source,
    card: {
      id: `occurrence-${occurrence.id}`,
      section: source.section,
      label: occurrence.label,
      art: source.art,
      date: occurrence.date,
      endDate: occurrence.endDate,
      eventStatus: occurrence.status,
      places: occurrence.places,
      payments: [],
      amount: null,
    },
  }));
}

export type PackedCardPosition = Readonly<{ column: number; top: number; height: number }>;
type MeasuredCard = Readonly<{ id: string; height: number }>;

export function packRealizedCards(cards: readonly MeasuredCard[], heightLimit: number, gap: number, fill: boolean) {
  const best = [{ start: 0, columns: 0, unused: 0, height: 0 }];
  for (let end = 1; end <= cards.length; end++) {
    let used = 0;
    let choice: typeof best[number] | undefined;
    for (let start = end - 1; start >= 0; start--) {
      used += cards[start]!.height + (start === end - 1 ? 0 : gap);
      if (used > heightLimit && start < end - 1) break;
      const previous = best[start]!;
      const columns = previous.columns + 1;
      const unused = previous.unused + Math.max(0, heightLimit - used) ** 2;
      // Keep the fewest columns, then spread any leftover height between them.
      if (!choice || columns < choice.columns || (columns === choice.columns && unused < choice.unused)) {
        choice = { start, columns, unused, height: used };
      }
    }
    best.push(choice!);
  }

  const positions: Record<string, PackedCardPosition> = {};
  const totalColumns = best[cards.length]!.columns;
  const fillColumns = fill && totalColumns > 1;
  let height = 0;
  for (let end = cards.length; end > 0;) {
    const { start, columns, height: used } = best[end]!;
    const free = Math.max(0, heightLimit - used);
    // Sparse views keep their natural height. The complete board fills every column.
    const extra = fillColumns ? free : used < heightLimit * .6 ? 0 : Math.min(32 * (end - start), free);
    const share = extra / (end - start);
    let top = 0;
    for (let index = start; index < end; index++) {
      const card = cards[index]!;
      const cardHeight = card.height + share;
      positions[card.id] = { column: columns - 1, top, height: cardHeight };
      top += cardHeight + gap;
    }
    height = Math.max(height, used + extra);
    end = start;
  }
  return { columns: totalColumns, height, positions };
}

/** Keep reading down within a category, then right. A later category can
 * start in available space below a previous one without moving either group. */
export function packRealizedCategories(
  groups: readonly { id: string; cards: readonly MeasuredCard[] }[],
  heightLimit: number, gap: number, inset: number, heading: number,
) {
  const bottoms: number[] = [];
  const positions: Record<string, PackedCardPosition> = {};
  const frames: Record<string, { column: number; top: number; height: number }[]> = {};
  const header = inset + heading;
  for (const group of groups) {
    const groupFrames: typeof frames[string] = [];
    let column = 0;
    let frame: typeof groupFrames[number] | undefined;
    for (const card of group.cards) {
      let bottom = bottoms[column] ?? 0;
      let top = frame ? bottom - inset + gap : bottom + (bottom ? gap : 0) + header;
      while (bottom > 0 && top + card.height + inset > heightLimit) {
        column += 1;
        frame = undefined;
        bottom = bottoms[column] ?? 0;
        top = bottom + (bottom ? gap : 0) + header;
      }
      if (!frame) {
        frame = { column, top: top - header, height: 0 };
        groupFrames.push(frame);
      }
      positions[card.id] = { column, top, height: card.height };
      bottoms[column] = top + card.height + inset;
      frame.height = bottoms[column]! - frame.top;
    }
    frames[group.id] = groupFrames;
  }
  return { columns: bottoms.length, height: Math.max(0, ...bottoms), positions, frames };
}
