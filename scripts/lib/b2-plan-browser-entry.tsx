import React from 'react';
import {createRoot} from 'react-dom/client';
import {AppliedMonthView} from '@/app/mois-a-venir/applied-month-view';
import {MonthSectionNav} from '@/app/mois-a-venir/month-section-nav';
import styles from '@/app/mois-a-venir/month-material.module.css';
const {props, key} = JSON.parse(document.getElementById('fixture')!.textContent!);
createRoot(document.getElementById('root')!).render(<main className={styles.page}>
  <p style={{fontSize:12,padding:8,background:'#faf3dc'}}>B2 · Cas {key} · Données synthétiques · PlanRevision persistée localement · Aucun accès Supabase</p>
  <nav aria-label="Mois préparé" className={styles.monthHeader}><a className={styles.monthLink} href='/?case=A'>← Octobre</a><h1>Novembre 2026</h1><a className={styles.monthLink} href='/?case=C'>Décembre →</a></nav>
  <MonthSectionNav appliedPlan hasProjects={false}/>
  <AppliedMonthView {...props}/>
</main>);
