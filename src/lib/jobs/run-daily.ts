/** הרצה מהטרמינל: npm run job:daily */
import { runDailyJob } from "./daily";

runDailyJob()
  .then((r) => {
    console.log(`job יומי הסתיים ב-${r.ranAt.toISOString()}`);
    console.log(`  תיקים שנסרקו: ${r.tripsScanned}`);
    console.log(`  אבני דרך שהשתנו: ${r.milestonesChanged}`);
    if (r.retired) console.log(`  מועדי ביטול שאיבדו רלוונטיות: ${r.retired}`);
    for (const s of r.statusChanges) console.log(`  תיק ${s.code}: ${s.from} → ${s.to}`);
    for (const e of r.errors) console.error(`  שגיאה בתיק ${e.tripId}: ${e.message}`);
    process.exit(r.errors.length ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
