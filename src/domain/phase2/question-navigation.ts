/** Presentation navigation shared by the expense wizard and Composer. No expense or financial state. */
export function nextUnansweredQuestion<T extends { id: string }>(questions: readonly T[], current: string | null,
  answered: (id: string) => boolean): T | undefined {
  return questions.find(question => question.id === current) ?? questions.find(question => !answered(question.id));
}
