import styles from "./background-rhythms.module.css";

export function RhythmAnnotation({ text }: { readonly text: string }) {
  return <p className={styles.rhythmAnnotation}>{text}</p>;
}
