import { connectDB } from '@/lib/db';
import { sendWhatsAppMessage, sendWhatsAppInteractiveList } from '@/lib/whatsapp';
import { parseCommand } from '@/lib/commandParser';
import { getPendingIntent, createPendingIntent, clearPendingIntent } from '@/lib/pendingIntent';
import { fuzzyMatch } from '@/lib/fuzzyMatch';
import User from '@/models/User';
import Todo from '@/models/Todo';
import Debt from '@/models/Debt';
import Deadline from '@/models/Deadline';
import ImportantDate from '@/models/ImportantDate';
import WatchlistItem from '@/models/WatchlistItem';
import ProcessedMessage from '@/models/ProcessedMessage';
import Reminder from '@/models/Reminder';
import { parseNaturalLanguage } from '@/lib/naturalParser';
import { logAudit } from '@/lib/audit';

const HELP_INDEX = `fih 🥀 *Help Center & Commands*
───────────────────────────────
Reply with *help <topic>* or *>help <topic>* for dedicated guides:

1️⃣ *help debt* — Money owed, balances, ledger & settlements
2️⃣ *help todo* — Tasks, priorities & completing items
3️⃣ *help reminder* — Timed alerts, natural dates & timetables
4️⃣ *help deadline* — Academic due dates & announcement parsing
5️⃣ *help watch* — Movies, shows, anime & reading lists
6️⃣ *help date* — Birthdays, anniversaries & annual events
7️⃣ *help list* — Filtering, sorting & search queries
8️⃣ *help controls* — Undo mistakes, cancel prompts & modes

💡 *Quick Tip:* You don't need \`>\` for natural language! E.g. just text "Hanan +100" or "Remind me tomorrow 9am".`;

const HELP_PAGES = {
  debt: `💰 *Debt & Financial Ledger Guide*
───────────────────────────────
Track money owed, borrowed, net balances, and settlements.

*1. Natural Language:*
• *Lending (Owed to you):*
  "Arjun +2080 Advance for Trek"
  "Hanan +500 for dinner"
  "Sarah owes me 300"
• *Borrowing (You owe):*
  "Arjun -1064 Return train"
  "Amir -50 for coffee"
  "I owe Hanan 200 for lunch"

*2. Direct Commands:*
• \`>debt owe <person> <amount> | <note>\`
• \`>debt owed <person> <amount> | <note>\`

*3. Balances & Net Position:*
• "how much i owe Arjun" — Net balance & notes
• "how much Arjun owes me"
• "what is my total balance" — Full financial overview
• \`>debt journal\` — Last 10 settled & active transactions

*4. Filtering & Sorting:*
• "show debts for Arjun" — Debts with Arjun only
• "show debts sorted by amount" — Highest to lowest
• "show debts sorted by person" — Grouped by contact
• "show debts sorted by time" — Most recent first

*5. Settling Debts:*
• \`>debt settle Arjun\` — Select individual debt to settle
• \`>debt settle all Arjun\` — Settle all debts with Arjun
• \`>debt settle Arjun 1064\` — Settle exact amount

_Type *help* to return to the Main Menu._`,

  todo: `📋 *To-Dos & Tasks Guide*
───────────────────────────────
Organize your daily tasks, action items, and priorities.

*1. Creating Tasks:*
• *Natural:* "Buy groceries", "Finish chemistry essay"
• *Command:* \`>todo Buy groceries\`
• *With Due Date:* \`>todo Submit paper | 2026-11-05 18:00\`

*2. Completing Tasks:*
• \`>done groceries\` — Matches title & marks complete
• If multiple match, fih will prompt you to pick a number.

*3. Viewing & Filtering:*
• \`>list todo\` — All open tasks
• "show todos by priority" — High ➔ Medium ➔ Low
• "show todos sorted by time" — Earliest due date first
• "my todos"

_Type *help* to return to the Main Menu._`,

  reminder: `⏰ *Smart Reminders & Timetables Guide*
───────────────────────────────
Time-specific alerts dispatched straight to your WhatsApp.

*1. Natural Reminders:*
• "Remind me tomorrow at 9am to submit forms"
• "Azithromycin tomorrow 3pm"
• "ticket book tmr" — Defaults to 9:00 AM IST
• "Remind me in 30 mins to take out laundry"

*2. Direct Command:*
• \`>reminder Buy medicine | tomorrow 3pm\`
• \`>reminder Call mom | 2026-11-02 10:00\`

*3. Class Timetables & Schedules:*
• Forward multiple class periods at once:
  "R5B tomorrow 4th hr AWT, 5th hr DAA"
• Automatically creates separate scheduled reminders!

*4. Viewing Reminders:*
• \`>list reminder\` — Upcoming scheduled alerts
• "my reminders"

_Type *help* to return to the Main Menu._`,

  deadline: `⏳ *Deadlines & Academic Tracker Guide*
───────────────────────────────
Track project submissions, evaluations, and circulars with live countdowns.

*1. Setting Deadlines:*
• *Natural:* "Submit AI lab report by Friday 5pm"
• *Specific Date:* "WT Evaluation on 11.08.2026 Tuesday"
• *Command:* \`>deadline AI Project Submission | 2026-11-15 23:59\`

*2. Forwarding Announcements:*
• Forward long circulars or class notices directly:
  "All students who have not yet registered for NPTEL exam must complete their registration today before 4:00 PM."
• fih automatically extracts the topic name and sets the deadline!

*3. Viewing Deadlines:*
• \`>list deadline\` — Upcoming deadlines with category tags
• "show deadlines for academic"

_Type *help* to return to the Main Menu._`,

  watch: `🎬 *Media & Reading Watchlist Guide*
───────────────────────────────
Save movies, TV shows, anime, and books to watch or read later.

*1. Adding to Watchlist:*
• *Show / Movie:* "Minions and Monster to watch"
• *Book / Paper:* "Harry Potter to read"
• *Command:* \`>watch Inception | movie\`
• *Command:* \`>watch Dune | book\`

*2. Marking Watched / Read:*
• \`>watched Inception 9/10\` — Marks watched with your rating!
• \`>watched Harry Potter\`

*3. Viewing Watchlist:*
• \`>list watch\` — Unwatched and unread items
• "my watchlist"

_Type *help* to return to the Main Menu._`,

  date: `⭐ *Important Dates & Anniversaries Guide*
───────────────────────────────
Keep track of birthdays, anniversaries, and annual milestones.

*1. Adding Dates:*
• *Birthday:* "Mom's birthday on 14th Sept"
• *Anniversary:* "Wedding anniversary on Oct 5"
• *Command:* \`>date Rahul Birthday | 09-14\`

*2. Recurring Tracking:*
• Anniversaries and birthdays recur yearly automatically.

*3. Viewing Dates:*
• \`>list date\` — All saved important dates
• "my dates"

_Type *help* to return to the Main Menu._`,

  list: `🔍 *List, Sort & Filter Reference*
───────────────────────────────
Query any module using powerful sorting and filters.

*1. Debts:*
• \`>list debt\` — All active debts
• "show debts for <person>" — Filter by contact name
• "show debts sorted by amount" — Highest amount first
• "show debts sorted by person" — Grouped with net totals
• "show debts sorted by time" — Most recent first

*2. Tasks & Deadlines:*
• \`>list todo\` / "show todos by priority"
• \`>list deadline\` / "show deadlines for academic"
• \`>list reminder\` / "show upcoming reminders"
• \`>list watch\` / \`>list date\`

_Type *help* to return to the Main Menu._`,

  controls: `⚙️ *Controls, Failsafes & Modes Guide*
───────────────────────────────
System shortcuts and configuration commands.

*1. Undo & Cancel:*
• \`undo\` — Made a typo or saved by mistake? Type \`undo\` to delete the last created item immediately.
• \`cancel\` — Dismisses any active question or interactive category selection prompt.

*2. Environment Modes:*
• \`>mode dev\` — Generates a 10-minute secure link to switch your account to the isolated Development sandbox.
• \`>mode live\` — Generates a link to return to the Live environment.
• Test new formats safely in dev mode without touching your real data!

_Type *help* to return to the Main Menu._`
};

function normalizeHelpTopic(rawTopic) {
  if (!rawTopic) return null;
  const t = rawTopic.trim().toLowerCase();
  if (t === '1' || t.includes('debt') || t.includes('money') || t.includes('iou') || t.includes('balance') || t.includes('settle')) return 'debt';
  if (t === '2' || t.includes('todo') || t.includes('task') || t.includes('done')) return 'todo';
  if (t === '3' || t.includes('remind')) return 'reminder';
  if (t === '4' || t.includes('deadline') || t.includes('exam') || t.includes('submi') || t.includes('announc')) return 'deadline';
  if (t === '5' || t.includes('watch') || t.includes('movie') || t.includes('show') || t.includes('book')) return 'watch';
  if (t === '6' || t.includes('date') || t.includes('birthday') || t.includes('annivers')) return 'date';
  if (t === '7' || t.includes('list') || t.includes('filter') || t.includes('sort') || t.includes('search') || t.includes('query')) return 'list';
  if (t === '8' || t.includes('control') || t.includes('mode') || t.includes('undo') || t.includes('cancel')) return 'controls';
  return null;
}

function formatTodo(t, i) {
  const due = t.dueDate ? ` (due ${new Date(t.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})` : '';
  const priority = t.priority !== 'medium' ? ` [${t.priority}]` : '';
  return `${i + 1}. ${t.title}${due}${priority}`;
}

function formatDebt(person, debts) {
  let owe = 0, owed = 0;
  debts.forEach(d => {
    if (d.direction === 'i_owe') owe += d.amount;
    else owed += d.amount;
  });
  const net = owed - owe;
  const label = net > 0 ? `owes you ₹${net}` : net < 0 ? `you owe ₹${Math.abs(net)}` : 'settled';
  return `${person}: ${label}`;
}

function parseDebtInput(text, defaultData = {}) {
  const clean = text.trim();
  const subTokens = clean.split(/\s+/);

  let action = defaultData.action;
  let person = defaultData.person;
  let amount = defaultData.amount;
  let note = defaultData.note || '';

  const numMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (numMatch && !amount) {
    amount = parseFloat(numMatch[1]);
  }

  if (/\b(owed|owes|receivable|to_me)\b/i.test(clean)) {
    action = 'owed';
  } else if (/\b(owe|pay|payable)\b/i.test(clean)) {
    action = 'owe';
  } else if (/\b(settle|settled)\b/i.test(clean)) {
    action = 'settle';
  }

  const keywords = ['owe', 'owed', 'owes', 'settle', 'i', 'me', 'my', 'you', 'he', 'she', 'to', 'for', 'from', 'with', 'rs', 'inr', '₹', 'hi', 'hello', 'hey', 'todo', 'to-do', 'reminder', 'debt', 'deadline', 'date', 'watch', 'watchlist', 'cancel', 'yes', 'no'];
  const nameTokens = subTokens.filter(t => !/^\d+(?:\.\d+)?$/.test(t) && !keywords.includes(t.toLowerCase()));
  if (nameTokens.length > 0 && !person) {
    person = nameTokens.join(' ');
  }

  return { action, person, amount, note };
}

async function handleCommand(parsed, userId, reply, envMode = 'live') {
  const envQuery = envMode === 'live'
    ? { userId, $or: [{ environmentMode: 'live' }, { environmentMode: { $exists: false } }] }
    : { userId, environmentMode: 'development' };

  switch (parsed.type) {
    case 'greeting':
      return reply(`👋 Hey! I'm *fih*, your personal life assistant.\n\nHere's what you can send me:\n• *To-dos:* "Buy groceries", ">todo Finish essay"\n• *Reminders:* "Remind me tomorrow at 9am to submit forms"\n• *Deadlines:* "Submit AI lab report by Friday 5pm"\n• *Debts:* "I owe Alex 500 for dinner", "Sarah paid me 200"\n• *Watchlist:* "Add Inception to watch"\n• *Announcements:* Forward long class messages or schedules directly!\n\nType *help* or *menu* anytime to see all commands.`);
    case 'help': {
      const topic = normalizeHelpTopic(parsed.topic);
      if (topic && HELP_PAGES[topic]) {
        return reply(HELP_PAGES[topic]);
      }
      return reply(HELP_INDEX);
    }

    case 'did_you_mean':
      return reply(`Did you mean \`>${parsed.suggestion}\`? Try \`>help\` for all commands.`);

    case 'error':
      return reply(parsed.message);

    case 'mode': {
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const userDoc = await User.findById(userId);
      if (!userDoc) return reply('User not found.');
      
      userDoc.modeSwitchToken = token;
      userDoc.modeSwitchExpires = expires;
      await userDoc.save();

      // Assuming NEXT_PUBLIC_BASE_URL is set or we construct it.
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fih-app.com';
      const switchUrl = `${baseUrl}/switch-mode?token=${token}&mode=${parsed.targetMode}`;
      
      return reply(`To switch to ${parsed.targetMode.toUpperCase()} mode, please enter your password securely here (link expires in 10 minutes):\n${switchUrl}`);
    }

    case 'todo': {
      const todo = await Todo.create({ userId, title: parsed.title, dueDate: parsed.dueDate, environmentMode: envMode });
      await logAudit(userId, {
        action: 'CREATE',
        module: 'todo',
        description: `Created to-do via WhatsApp: "${todo.title}"`,
        environmentMode: envMode
      });
      const due = todo.dueDate ? ` — due ${new Date(todo.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}` : '';
      return reply(`✅ To-do added: "${todo.title}"${due}`);
    }

    case 'done': {
      const openTodos = await Todo.find({ ...envQuery, status: 'open' });
      const { match, ambiguous, candidates } = fuzzyMatch(parsed.query, openTodos);
      if (!match && !ambiguous)
        return reply(`Couldn't find an open to-do matching that. Try \`>list todo\`.`);
      if (ambiguous) {
        const list = candidates.slice(0, 5).map((c, i) => `${i + 1}. ${c.item.title}`).join('\n');
        await createPendingIntent(userId, {
          module: 'done_pick',
          partialData: { candidates: candidates.slice(0, 5).map(c => c.item._id.toString()) },
          missingField: 'pick',
          question: `Which one?\n${list}`,
          environmentMode: envMode,
        });
        return reply(`Which one?\n${list}`);
      }
      match.status = 'done';
      match.completedAt = new Date();
      await match.save();
      await logAudit(userId, {
        action: 'UPDATE',
        module: 'todo',
        description: `Completed to-do via WhatsApp: "${match.title}"`,
        environmentMode: envMode
      });
      return reply(`✅ Marked done: "${match.title}"`);
    }

    case 'debt': {
      if (parsed.action === 'history' || parsed.action === 'journal') {
        const debts = await Debt.find(envQuery).sort({ createdAt: -1 }).limit(10);
        if (!debts.length) return reply('Your transaction journal is empty.');
        const lines = debts.map((d, i) => {
          const dir = d.direction === 'i_owe' ? 'you owe' : 'owes you';
          const status = d.settled ? ` [Settled ${d.settledDate ? new Date(d.settledDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}]` : ' [Active]';
          return `${i + 1}. ${d.person} (${dir} ₹${d.amount})${d.note ? ` - ${d.note}` : ''}${status}`;
        });
        return reply(`📜 Transaction Journal (Last 10):\n\n${lines.join('\n')}`);
      }

      if (parsed.action === 'settle_all') {
        const debts = await Debt.find({ ...envQuery, person: new RegExp(`^${parsed.person}$`, 'i'), settled: false });
        const fallbackDebts = debts.length ? debts : await Debt.find({ ...envQuery, person: new RegExp(parsed.person, 'i'), settled: false });
        if (!fallbackDebts.length) return reply(`No unsettled debts found for "${parsed.person}".`);
        
        let totalAmount = 0;
        fallbackDebts.forEach(d => { totalAmount += d.amount; });
        await Debt.updateMany({ _id: { $in: fallbackDebts.map(d => d._id) } }, { settled: true, settledDate: new Date() });
        await logAudit(userId, {
          action: 'UPDATE',
          module: 'debt',
          description: `Settled all debts with ${fallbackDebts[0].person} (₹${totalAmount}) via WhatsApp`,
          environmentMode: envMode
        });
        return reply(`✅ Settled all ${fallbackDebts.length} debt(s) with ${fallbackDebts[0].person} (Total: ₹${totalAmount}). Saved to Journal.`);
      }

      if (parsed.action === 'settle') {
        const exactDebts = await Debt.find({ ...envQuery, person: new RegExp(`^${parsed.person}$`, 'i'), settled: false }).sort({ createdAt: 1 });
        const debts = exactDebts.length ? exactDebts : await Debt.find({ ...envQuery, person: new RegExp(parsed.person, 'i'), settled: false }).sort({ createdAt: 1 });
        
        if (!debts.length) return reply(`No unsettled debts found for "${parsed.person}".`);

        if (parsed.amount) {
          const matchByAmount = debts.find(d => d.amount === parsed.amount);
          const target = matchByAmount || debts[0];
          target.settled = true;
          target.settledDate = new Date();
          await target.save();
          await logAudit(userId, {
            action: 'UPDATE',
            module: 'debt',
            description: `Settled individual debt with ${target.person}: ₹${target.amount} (${target.note || 'no note'}) via WhatsApp`,
            environmentMode: envMode
          });
          return reply(`✅ Settled individual debt with ${target.person}: ₹${target.amount}${target.note ? ` (${target.note})` : ''}.`);
        }

        if (debts.length === 1) {
          const target = debts[0];
          target.settled = true;
          target.settledDate = new Date();
          await target.save();
          await logAudit(userId, {
            action: 'UPDATE',
            module: 'debt',
            description: `Settled debt with ${target.person}: ₹${target.amount} (${target.note || 'no note'}) via WhatsApp`,
            environmentMode: envMode
          });
          return reply(`✅ Settled debt with ${target.person}: ₹${target.amount}${target.note ? ` (${target.note})` : ''}.`);
        }

        const listText = debts.map((d, i) => {
          const dir = d.direction === 'i_owe' ? 'YOU OWE' : 'OWES YOU';
          return `${i + 1}. ${dir} ₹${d.amount}${d.note ? ` (${d.note})` : ''}`;
        }).join('\n');

        await createPendingIntent(userId, {
          module: 'debt_settle_pick',
          partialData: { candidates: debts.map(d => d._id.toString()), person: debts[0].person },
          missingField: 'pick',
          question: `Multiple active debts found for ${debts[0].person}. Which one would you like to settle?\n\n${listText}\n\nReply with a number (1-${debts.length}) or type "all" to settle all.`,
          environmentMode: envMode
        });
        return reply(`Multiple active debts found for ${debts[0].person}. Which one would you like to settle?\n\n${listText}\n\nReply with a number (1-${debts.length}) or type "all" to settle all.`);
      }
      const debt = await Debt.create({
        userId, person: parsed.person, amount: parsed.amount,
        direction: parsed.direction, note: parsed.note, environmentMode: envMode,
      });
      await logAudit(userId, {
        action: 'CREATE',
        module: 'debt',
        description: `Recorded debt via WhatsApp: ${parsed.direction === 'i_owe' ? 'owe' : 'owed'} ${debt.person} ₹${debt.amount}`,
        environmentMode: envMode
      });
      const dir = parsed.direction === 'i_owe' ? `you owe ${debt.person}` : `${debt.person} owes you`;
      return reply(`✅ Recorded: ${dir} ₹${debt.amount}${debt.note ? ` (${debt.note})` : ''}`);
    }

    case 'deadline': {
      const dl = await Deadline.create({
        userId, title: parsed.title, dueDate: parsed.dueDate, category: parsed.category, environmentMode: envMode,
      });
      await logAudit(userId, {
        action: 'CREATE',
        module: 'deadline',
        description: `Created deadline via WhatsApp: "${dl.title}"`,
        environmentMode: envMode
      });
      return reply(`✅ Deadline added: "${dl.title}" — due ${new Date(dl.dueDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })} (${dl.category})`);
    }

    case 'reminder': {
      const r = await Reminder.create({
        userId, title: parsed.title, remindAt: parsed.remindAt, environmentMode: envMode,
      });
      await logAudit(userId, {
        action: 'CREATE',
        module: 'reminder',
        description: `Created reminder via WhatsApp: "${r.title}"`,
        environmentMode: envMode
      });
      return reply(`⏰ Reminder set: "${r.title}" — ${new Date(r.remindAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}`);
    }

    case 'date': {
      const d = await ImportantDate.create({
        userId, title: parsed.title, date: parsed.date, recurring: parsed.recurring, environmentMode: envMode,
      });
      await logAudit(userId, {
        action: 'CREATE',
        module: 'date',
        description: `Saved important date via WhatsApp: "${d.title}"`,
        environmentMode: envMode
      });
      return reply(`✅ Date saved: "${d.title}" on ${d.date}${d.recurring !== 'none' ? ` (${d.recurring})` : ''}`);
    }

    case 'watch': {
      if (parsed.watchAction === 'add') {
        const item = await WatchlistItem.create({ userId, title: parsed.title, type: parsed.watchType, environmentMode: envMode });
        await logAudit(userId, {
          action: 'CREATE',
          module: 'watch',
          description: `Added "${item.title}" to watchlist via WhatsApp [${parsed.watchType}]`,
          environmentMode: envMode
        });
        return reply(`✅ Added to watchlist: "${item.title}"`);
      }
      // done
      const items = await WatchlistItem.find({ ...envQuery, status: { $ne: 'done' } });
      const { match, ambiguous, candidates } = fuzzyMatch(parsed.query, items);
      if (!match && !ambiguous) return reply(`Couldn't find "${parsed.query}" in your watchlist.`);
      if (ambiguous) {
        const list = candidates.slice(0, 5).map((c, i) => `${i + 1}. ${c.item.title}`).join('\n');
        await createPendingIntent(userId, {
          module: 'watch_done_pick',
          partialData: { candidates: candidates.slice(0, 5).map(c => c.item._id.toString()), rating: parsed.rating },
          missingField: 'pick',
          question: `Which one?\n${list}`,
          environmentMode: envMode,
        });
        return reply(`Which one?\n${list}`);
      }
      match.status = 'done';
      if (parsed.rating) match.rating = parsed.rating;
      await match.save();
      await logAudit(userId, {
        action: 'UPDATE',
        module: 'watch',
        description: `Completed watching/reading via WhatsApp: "${match.title}"${parsed.rating ? ` (rated ${parsed.rating}/10)` : ''}`,
        environmentMode: envMode
      });
      return reply(`✅ Marked as watched: "${match.title}"${parsed.rating ? ` — rated ${parsed.rating}/10` : ''}`);
    }

    case 'list': {
      const mod = parsed.module;
      const sort = parsed.sortBy || 'default';
      const pf = parsed.personFilter;

      if (mod === 'todo') {
        let todos = await Todo.find({ ...envQuery, status: 'open' });
        if (sort === 'priority') {
          const pOrder = { high: 0, medium: 1, low: 2 };
          todos.sort((a, b) => (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1));
        } else if (sort === 'time') {
          todos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else {
          todos.sort((a, b) => (a.dueDate || Infinity) - (b.dueDate || Infinity));
        }
        if (!todos.length) return reply('No open to-dos!');
        return reply(`📋 Open to-dos${sort !== 'default' ? ` (sorted by ${sort})` : ''}:\n${todos.map(formatTodo).join('\n')}`);
      }

      if (mod === 'debt') {
        let debts = await Debt.find({ ...envQuery, settled: false });
        if (pf) {
          const filter = pf.toLowerCase();
          debts = debts.filter(d => d.person.toLowerCase().includes(filter));
        }
        if (sort === 'amount') {
          debts.sort((a, b) => b.amount - a.amount);
        } else if (sort === 'time') {
          debts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        if (!debts.length) return reply(pf ? `No unsettled debts with ${pf}!` : 'No unsettled debts!');
        const byPerson = {};
        debts.forEach(d => { byPerson[d.person] = byPerson[d.person] || []; byPerson[d.person].push(d); });
        const lines = Object.entries(byPerson).map(([p, ds]) => formatDebt(p, ds));
        return reply(`💰 Debts${pf ? ` (${pf})` : ''}${sort !== 'default' ? ` (sorted by ${sort})` : ''}:\n${lines.join('\n')}`);
      }

      if (mod === 'deadline') {
        let deadlines = await Deadline.find(envQuery);
        if (pf) {
          const filter = pf.toLowerCase();
          deadlines = deadlines.filter(d => d.category.toLowerCase().includes(filter) || d.title.toLowerCase().includes(filter));
        }
        if (sort === 'time' || sort === 'default') {
          deadlines.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        }
        if (!deadlines.length) return reply(pf ? `No deadlines matching "${pf}"!` : 'No deadlines!');
        const lines = deadlines.map((d, i) => `${i + 1}. ${d.title} — ${new Date(d.dueDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })} [${d.category}]`);
        return reply(`⏳ Deadlines${pf ? ` (${pf})` : ''}:\n${lines.join('\n')}`);
      }

      if (mod === 'reminder') {
        let reminders = await Reminder.find({ ...envQuery, sent: false });
        if (sort === 'time' || sort === 'default') {
          reminders.sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));
        }
        if (!reminders.length) return reply('No pending reminders!');
        const lines = reminders.map((r, i) => `${i + 1}. ${r.title} — ${new Date(r.remindAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}`);
        return reply(`⏰ Reminders:\n${lines.join('\n')}`);
      }

      if (mod === 'date') {
        let dates = await ImportantDate.find(envQuery).sort({ date: 1 });
        if (pf) {
          const filter = pf.toLowerCase();
          dates = dates.filter(d => d.title.toLowerCase().includes(filter));
        }
        if (!dates.length) return reply(pf ? `No dates matching "${pf}"!` : 'No important dates!');
        const lines = dates.map((d, i) => `${i + 1}. ${d.title} — ${d.date}${d.recurring !== 'none' ? ` (${d.recurring})` : ''}`);
        return reply(`📅 Important dates${pf ? ` (${pf})` : ''}:\n${lines.join('\n')}`);
      }

      if (mod === 'watch') {
        let items = await WatchlistItem.find(envQuery);
        if (pf) {
          const filter = pf.toLowerCase();
          items = items.filter(it => it.type.toLowerCase().includes(filter) || it.title.toLowerCase().includes(filter));
        }
        if (sort === 'default') {
          items.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));
        }
        if (!items.length) return reply(pf ? `No watchlist items matching "${pf}"!` : 'Your watchlist is empty!');
        const lines = items.map((it, i) => `${i + 1}. ${it.title} [${it.type}] — ${it.status}${it.rating ? ` ★${it.rating}` : ''}`);
        return reply(`🎬 Watchlist${pf ? ` (${pf})` : ''}:\n${lines.join('\n')}`);
      }

      return reply(`Unknown module. Try >list todo|debt|reminder|deadline|date|watch`);
    }

    case 'multi_reminder':
    case 'announcement': {
      const createdLines = [];
      for (const item of parsed.items) {
        if (item.type === 'deadline') {
          const dl = await Deadline.create({
            userId, title: item.title, dueDate: item.dueDate, category: item.category || 'academic', environmentMode: envMode,
          });
          createdLines.push(`⏳ Deadline added: "${dl.title}" — due ${new Date(dl.dueDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}`);
        } else if (item.type === 'todo') {
          const t = await Todo.create({ userId, title: item.title, environmentMode: envMode });
          createdLines.push(`📋 To-do added: "${t.title}"`);
        } else if (item.type === 'reminder') {
          const r = await Reminder.create({ userId, title: item.title, remindAt: item.remindAt, environmentMode: envMode });
          createdLines.push(`⏰ Reminder set: "${r.title}" — ${new Date(r.remindAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}`);
        }
      }
      const header = parsed.type === 'multi_reminder' ? '⏰ Reminders Scheduled!' : '📢 Announcement Processed!';
      return reply(`${header}\n\n${createdLines.join('\n')}`);
    }

    case 'balance_query': {
      const listParams = {
        module: 'debt',
        sortBy: 'default',
        personFilter: parsed.person || null
      };
      return handleListQuery(userId, listParams, reply, envMode);
    }

    default:
      return reply(`Sorry, I couldn't process that command. Try \`>help\`.`);
  }
}

export default async function handler(req, res) {
  // GET — Meta webhook verification handshake
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch {}
  }

  // Extract the message
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];

  if (change?.value?.statuses) {
    for (const st of change.value.statuses) {
      if (st.status === 'failed' || st.errors) {
        console.error('[WhatsApp Webhook Delivery Failure]:', JSON.stringify(st));
      }
    }
  }

  const messageObj = change?.value?.messages?.[0];
  const statusesObj = change?.value?.statuses?.[0];

  // Log incoming webhook to DB for live debugging
  try {
    await connectDB();
    const WebhookLog = (await import('@/models/WebhookLog')).default;
    const summary = messageObj 
      ? `Incoming message from ${messageObj.from}: "${messageObj.text?.body || messageObj.type}"` 
      : (statusesObj ? `Status update: ${statusesObj.status} for ${statusesObj.recipient_id} (${statusesObj.errors ? JSON.stringify(statusesObj.errors) : 'ok'})` : 'Non-message event');
    await WebhookLog.create({ summary, payload });
  } catch (logErr) {
    console.error('[WebhookLog Error]', logErr);
  }

  if (!messageObj) return res.status(200).end(); // ACK non-message events

  const messageId = messageObj.id;
  const from = messageObj.from; // E.164 without '+'
  
  let text = messageObj.text?.body?.trim();
  if (messageObj.type === 'interactive' && messageObj.interactive?.type === 'list_reply') {
    text = messageObj.interactive.list_reply.id;
  } else if (messageObj.type === 'interactive' && messageObj.interactive?.type === 'button_reply') {
    text = messageObj.interactive.button_reply.id;
  }

  if (text && text.includes('Please select a category:')) {
    const after = text.split(/Please select a category:\s*/i)[1] || '';
    const selectedLine = after.trim().split(/[\r\n]+/)[0].trim().toLowerCase();
    if (selectedLine.includes('to-do') || selectedLine === 'todo' || selectedLine === '1') text = '1';
    else if (selectedLine.includes('reminder') || selectedLine === '2') text = '2';
    else if (selectedLine.includes('debt') || selectedLine === '3') text = '3';
    else if (selectedLine.includes('deadline') || selectedLine === '4') text = '4';
    else if (selectedLine.includes('date') || selectedLine === '5') text = '5';
    else if (selectedLine.includes('watchlist') || selectedLine === 'watch' || selectedLine === '6') text = '6';
    else if (selectedLine.includes('cancel') || selectedLine === '7') text = 'cancel';
  }
  
  if (!messageId || !from) return res.status(200).end();

  await connectDB();

  // Find user by WhatsApp number (flexible digit matching & single-user fallback)
  const cleanFrom = from.replace(/\D/g, '');
  const allUsers = await User.find({});
  let user = allUsers.find(u => {
    const userDigits = (u.whatsappNumber || '').replace(/\D/g, '');
    return userDigits && (userDigits === cleanFrom || cleanFrom.endsWith(userDigits) || userDigits.endsWith(cleanFrom));
  });

  console.log(`[WhatsApp Webhook Incoming] from=${from} text="${text}" id=${messageId}`);

  if (!user && allUsers.length > 0) {
    console.warn(`[WhatsApp Webhook] No exact phone match for from=${from}. Falling back to primary user (${allUsers[0].email})`);
    user = allUsers[0];
  }

  if (!user) {
    console.warn('Unknown WhatsApp sender:', from);
    return res.status(200).end();
  }

  const userId = user._id;
  const envMode = user.environmentMode || 'live';
  const reply = (msg) => sendWhatsAppMessage(from, msg);

  // Deduplicate message processing via ProcessedMessage TTL collection (atomic create-first)
  try {
    await ProcessedMessage.create({ messageId });
  } catch (err) {
    if (err.code === 11000) return res.status(200).end(); // Already processed
    console.error('Dedup check error:', err);
  }

  if (!text) {
    await reply("💬 Send your note, command, or deadline as a text message.");
    return res.status(200).end();
  }

  try {
    // Check for pending intent
  const pending = await getPendingIntent(userId);

  if (!pending && ['cancel', 'abort', 'stop', 'exit'].includes(text.toLowerCase().trim())) {
    await reply('Nothing to cancel.');
    return res.status(200).end();
  }

  if (pending) {
    const textLower = text.toLowerCase().trim();
    const freshNatural = parseNaturalLanguage(text);

    // Explicit cancel
    if (['cancel', 'abort', 'stop', 'exit', 'nevermind', 'never mind'].includes(textLower)) {
      await clearPendingIntent(userId);
      await reply('❌ Cancelled.');
      return res.status(200).end();
    }

    const isCommand = text.startsWith('>');
    const isGreeting = freshNatural.type === 'greeting';
    const isAnnouncement = freshNatural.type === 'announcement' || freshNatural.type === 'multi_reminder';
    const isHelp = freshNatural.type === 'help';
    const isCategoryPickerResponse = ['1', '2', '3', '4', '5', '6', '7', 'todo', 'to-do', 'reminder', 'watchlist', 'deadline'].includes(textLower);

    // Global failsafe override: If user sends an explicit command, greeting, or announcement, clear stale pending intent!
    if (isCommand || isGreeting || isAnnouncement || isHelp) {
      await clearPendingIntent(userId);
      // Fall through to main message processing below
    } else if (pending.module === 'debt' && isCategoryPickerResponse) {
      // User tapped or replied with category while trapped in debt prompt
      await clearPendingIntent(userId);
      // Fall through to main message processing below
    } else if (pending.module === 'debt' && freshNatural.confidence === 'high' && freshNatural.type !== 'debt') {
      await clearPendingIntent(userId);
      // Fall through to main message processing below
    } else {
    // Handle numbered pick for ambiguous fuzzy matches
    if (['done_pick', 'watch_done_pick'].includes(pending.module)) {
      const pick = parseInt(text, 10);
      const ids = pending.partialData.candidates;
      if (isNaN(pick) || pick < 1 || pick > ids.length) {
        await reply(`Please reply with a number between 1 and ${ids.length}.`);
        return res.status(200).end();
      }
      const chosenId = ids[pick - 1];
      await clearPendingIntent(userId);
      if (pending.module === 'done_pick') {
        const todo = await Todo.findById(chosenId);
        todo.status = 'done'; todo.completedAt = new Date();
        await todo.save();
        await logAudit(userId, {
          action: 'UPDATE',
          module: 'todo',
          description: `Completed to-do via WhatsApp selection: "${todo.title}"`,
          environmentMode: envMode
        });
        await reply(`✅ Marked done: "${todo.title}"`);
      } else {
        const item = await WatchlistItem.findById(chosenId);
        item.status = 'done';
        if (pending.partialData.rating) item.rating = pending.partialData.rating;
        await item.save();
        await logAudit(userId, {
          action: 'UPDATE',
          module: 'watch',
          description: `Completed watching/reading via WhatsApp selection: "${item.title}"${pending.partialData.rating ? ` (rated ${pending.partialData.rating}/10)` : ''}`,
          environmentMode: envMode
        });
        await reply(`✅ Marked as watched: "${item.title}"${pending.partialData.rating ? ` — rated ${pending.partialData.rating}/10` : ''}`);
      }
      return res.status(200).end();
    }

    if (pending.module === 'debt_settle_pick') {
      const textLower = text.trim().toLowerCase();
      const ids = pending.partialData.candidates;
      const personName = pending.partialData.person;

      if (textLower === 'all' || textLower === 'all debts') {
        await Debt.updateMany({ _id: { $in: ids } }, { settled: true, settledDate: new Date() });
        await clearPendingIntent(userId);
        await logAudit(userId, {
          action: 'UPDATE',
          module: 'debt',
          description: `Settled all debts with ${personName} via WhatsApp selection`,
          environmentMode: envMode
        });
        await reply(`✅ Settled all debts with ${personName}.`);
        return res.status(200).end();
      }

      const pick = parseInt(text, 10);
      if (isNaN(pick) || pick < 1 || pick > ids.length) {
        await reply(`Please reply with a number between 1 and ${ids.length}, or type "all".`);
        return res.status(200).end();
      }

      const chosenId = ids[pick - 1];
      await clearPendingIntent(userId);
      const debt = await Debt.findById(chosenId);
      if (debt) {
        debt.settled = true;
        debt.settledDate = new Date();
        await debt.save();
        await logAudit(userId, {
          action: 'UPDATE',
          module: 'debt',
          description: `Settled individual debt with ${debt.person}: ₹${debt.amount} (${debt.note || 'no note'}) via WhatsApp selection`,
          environmentMode: envMode
        });
        await reply(`✅ Settled individual debt with ${debt.person}: ₹${debt.amount}${debt.note ? ` (${debt.note})` : ''}.`);
      } else {
        await reply(`Debt record not found.`);
      }
      return res.status(200).end();
    }

    // Handle debt pending intent
    if (pending.module === 'debt') {
      const merged = parseDebtInput(text, pending.partialData);
      if (merged.person && merged.amount && merged.action) {
        await clearPendingIntent(userId);
        const direction = merged.action === 'owe' ? 'i_owe' : 'owed_to_me';
        const debt = await Debt.create({
          userId, person: merged.person, amount: merged.amount,
          direction, note: merged.note, environmentMode: user.environmentMode || 'live',
        });
        const dir = direction === 'i_owe' ? `you owe ${debt.person}` : `${debt.person} owes you`;
        await reply(`✅ Recorded: ${dir} ₹${debt.amount}${debt.note ? ` (${debt.note})` : ''}`);
        return res.status(200).end();
      }

      await createPendingIntent(userId, {
        module: 'debt',
        partialData: merged,
        missingField: 'details',
        question: !merged.person ? `Who is this debt with?` : !merged.amount ? `How much is the amount?` : `Do you owe ${merged.person} or do they owe you?`,
        environmentMode: user.environmentMode || 'live'
      });

      const promptMsg = !merged.person && !merged.amount ? `Who is this debt with and what is the amount?\n(Reply e.g.: Andrew 177 owed OR Alex 500 owe)`
        : !merged.person ? `Who is this debt of ₹${merged.amount} with?\n(Reply e.g.: Andrew owed OR Alex owe)`
        : !merged.amount ? `How much is the debt with ${merged.person}?\n(Reply e.g.: 500)`
        : `Did you owe ${merged.person} or do they owe you?\n(Reply owe OR owed)`;
      await reply(promptMsg);
      return res.status(200).end();
    }

    // Handle undo_last failsafe intent
    if (pending.module === 'undo_last') {
      const lower = text.trim().toLowerCase();
      if (['undo', 'cancel', 'wrong', 'revert', 'delete'].includes(lower)) {
        const { targetModule, targetId, label } = pending.partialData;
        await clearPendingIntent(userId);

        if (targetModule === 'debt') await Debt.deleteOne({ _id: targetId, userId });
        if (targetModule === 'todo') await Todo.deleteOne({ _id: targetId, userId });
        if (targetModule === 'deadline') await Deadline.deleteOne({ _id: targetId, userId });
        if (targetModule === 'date') await ImportantDate.deleteOne({ _id: targetId, userId });
        if (targetModule === 'watch') await WatchlistItem.deleteOne({ _id: targetId, userId });
        if (targetModule === 'reminder') await Reminder.deleteOne({ _id: targetId, userId });

        await reply(`🗑️ Undone! Removed "${label}".`);
        return res.status(200).end();
      }
    }

    // Handle classify_forward pending intent for forwarded / plain text messages
    if (pending.module === 'classify_forward') {
      const choice = text.trim().toLowerCase();
      const rawText = pending.partialData.rawText;

      // Failsafe override: If user sends a fresh high-confidence statement or command, clear stale prompt!
      const freshNatural = parseNaturalLanguage(text);
      if (freshNatural.confidence === 'high' || text.startsWith('>')) {
        await clearPendingIntent(userId);
        // Do not return — let execution fall through to process fresh message!
      } else {
        if (choice === '1' || choice === 'todo' || choice.includes('to-do')) {
        await clearPendingIntent(userId);
        const todo = await Todo.create({ userId, title: rawText, environmentMode: user.environmentMode || 'live' });
        await reply(`✅ To-do added: "${todo.title}"`);
        return res.status(200).end();
      }

        if (choice === '2' || choice === 'reminder' || choice.includes('remind')) {
          await clearPendingIntent(userId);
          const reminder = await Reminder.create({ userId, title: rawText, remindAt: new Date(Date.now() + 60 * 60 * 1000), environmentMode: user.environmentMode || 'live' });
          await reply(`🔔 Reminder set: "${reminder.title}"`);
          return res.status(200).end();
        }

        if (choice === '3' || choice === 'debt') {
          await clearPendingIntent(userId);
          const parsedData = parseDebtInput(rawText);
          if (parsedData.person && parsedData.amount && parsedData.action) {
            const direction = parsedData.action === 'owe' ? 'i_owe' : 'owed_to_me';
            const debt = await Debt.create({
              userId, person: parsedData.person, amount: parsedData.amount,
              direction, note: parsedData.note, environmentMode: user.environmentMode || 'live',
            });
            const dir = direction === 'i_owe' ? `you owe ${debt.person}` : `${debt.person} owes you`;
            await reply(`✅ Recorded: ${dir} ₹${debt.amount}${debt.note ? ` (${debt.note})` : ''}`);
            return res.status(200).end();
          }

          await createPendingIntent(userId, {
            module: 'debt',
            partialData: parsedData,
            missingField: 'details',
            question: !parsedData.person ? `Who is this debt with?` : `How much is the amount?`,
            environmentMode: user.environmentMode || 'live'
          });

          const promptMsg = !parsedData.person && !parsedData.amount ? `Who is this debt with and what is the amount?\n(Reply e.g.: Andrew 177 owed OR Alex 500 owe)`
            : !parsedData.person ? `Who is this debt of ₹${parsedData.amount} with?\n(Reply e.g.: Andrew owed OR Alex owe)`
            : !parsedData.amount ? `How much is the debt with ${parsedData.person}?\n(Reply e.g.: 500)`
            : `Did you owe ${parsedData.person} or do they owe you?\n(Reply owe OR owed)`;
          await reply(promptMsg);
          return res.status(200).end();
        }

        if (choice === '4' || choice === 'deadline') {
          await clearPendingIntent(userId);
          const parsedDl = parseCommand(`>deadline ${rawText}`);
          if (parsedDl.type === 'deadline') {
            await handleCommand(parsedDl, userId, reply, user.environmentMode || 'live');
            return res.status(200).end();
          }
          await createPendingIntent(userId, {
            module: 'deadline',
            partialData: { title: rawText },
            missingField: 'dueDate',
            question: `When is "${rawText}" due?\n(Reply e.g.: 2026-08-15 18:00)`,
            environmentMode: user.environmentMode || 'live'
          });
          await reply(`When is "${rawText}" due?\n(Reply e.g.: 2026-08-15 18:00)`);
          return res.status(200).end();
        }

        if (choice === '5' || choice === 'date') {
          await clearPendingIntent(userId);
          const parsedDate = parseCommand(`>date ${rawText}`);
          if (parsedDate.type === 'date') {
            await handleCommand(parsedDate, userId, reply, user.environmentMode || 'live');
            return res.status(200).end();
          }
          await createPendingIntent(userId, {
            module: 'date',
            partialData: { title: rawText },
            missingField: 'date',
            question: `What is the date for "${rawText}"?\n(Reply e.g.: 09-14 for birthday or 2026-11-01)`,
            environmentMode: user.environmentMode || 'live'
          });
          await reply(`What is the date for "${rawText}"?\n(Reply e.g.: 09-14 for birthday or 2026-11-01)`);
          return res.status(200).end();
        }

        if (choice === '6' || choice === 'watch' || choice.includes('watchlist')) {
          await clearPendingIntent(userId);
          let cleanTitle = rawText
            .replace(/\b(?:to\s+)?(?:watch|read|binge|stream)\b/gi, '')
            .replace(/^(?:watch|watching|movie|show|anime|read|reading|binge|binging|stream|streaming|add|book)\b/gi, '')
            .replace(/\b(?:watchlist|to my watchlist)\b/gi, '')
            .replace(/^[\s,\-–:]+/, '')
            .replace(/[\s,\-–:]+$/, '')
            .replace(/\s+/g, ' ')
            .trim();
          cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

          const isBook = /\b(read|reading|paper|book)\b/i.test(rawText);
          const item = await WatchlistItem.create({ userId, title: cleanTitle || rawText, type: isBook ? 'book' : 'show', environmentMode: user.environmentMode || 'live' });
          await reply(`✅ Added to watchlist: "${item.title}" [${item.type}]`);
          return res.status(200).end();
        }

        if (choice === '7' || choice === 'cancel' || choice.includes('cancel')) {
          await clearPendingIntent(userId);
          await reply('Cancelled.');
          return res.status(200).end();
        }

        await reply(`Please reply with 1-7 or type cancel:\n1. To-do\n2. Reminder\n3. Debt\n4. Deadline\n5. Important Date\n6. Watchlist\n7. Cancel`);
        return res.status(200).end();
      }
    }

    // Meta / internal intent modules (do not run synthetic command)
    if (['classify_forward', 'undo_last', 'done_pick', 'watch_done_pick'].includes(pending.module)) {
      await clearPendingIntent(userId);
      // Fall through to main message processing
    } else {
      // Generic field answer for multi-step prompts (e.g. missing amount/person)
      const newPartial = { ...pending.partialData, [pending.missingField]: text };
      const syntheticCommand = buildSyntheticCommand(pending.module, newPartial);
      const reParsed = parseCommand(syntheticCommand);
      await clearPendingIntent(userId);

      if (reParsed.type === 'missing') {
        await createPendingIntent(userId, { ...reParsed, environmentMode: user.environmentMode || 'live' });
        await reply(reParsed.question);
      } else {
        await handleCommand(reParsed, userId, reply, user.environmentMode || 'live');
      }
      return res.status(200).end();
    }
    }
  }

  // Main message processing (commands and natural language parsing)
  if (text.startsWith('>')) {
    const parsed = parseCommand(text);
    if (parsed.type === 'missing') {
      await createPendingIntent(userId, { ...parsed, environmentMode: user.environmentMode || 'live' });
      await reply(parsed.question);
    } else {
      await handleCommand(parsed, userId, reply, user.environmentMode || 'live');
    }
    return res.status(200).end();
  }

  const naturalResult = parseNaturalLanguage(text);

  if (naturalResult.type === 'list') {
    await handleListQuery(userId, naturalResult, reply, user.environmentMode || 'live');
    return res.status(200).end();
  }

  if (naturalResult.confidence === 'high') {
      await handleCommand(naturalResult, userId, reply, user.environmentMode || 'live');
    return res.status(200).end();
  }

  // Fallback for low-confidence / unclassified messages
  await createPendingIntent(userId, {
    module: 'classify_forward',
    partialData: { rawText: text },
    missingField: 'module',
    question: `I wasn't sure how to save that. Select a category:`,
    environmentMode: user.environmentMode || 'live'
  });
  
  const sections = [
    {
      title: 'Categories',
      rows: [
        { id: '1', title: 'To-do', description: 'Tasks and action items' },
        { id: '2', title: 'Reminder', description: 'Time-specific alerts' },
        { id: '3', title: 'Debt', description: 'Money owed/borrowed' },
        { id: '4', title: 'Deadline', description: 'Due dates' },
        { id: '5', title: 'Important Date', description: 'Birthdays & Anniversaries' },
        { id: '6', title: 'Watchlist', description: 'Movies, shows, books' },
        { id: 'cancel', title: 'Cancel', description: 'Dismiss without saving' }
      ]
    }
  ];

  // Try interactive list first; fall back to plain text if it fails.
  // If both fail, clear the pending intent so the bot is never silently locked up.
  try {
    const listRes = await sendWhatsAppInteractiveList(
      from, 
      `I wasn't sure how to save "${text}".\nPlease select a category:`, 
      'Select Category', 
      sections
    );
    // sendWhatsAppInteractiveList calls res.json() — if the response wasn't ok, fall back
    if (listRes && listRes.error) {
      throw new Error(`Meta error: ${JSON.stringify(listRes.error)}`);
    }
  } catch (interactiveErr) {
    console.warn('[WhatsApp Webhook] Interactive list failed, falling back to plain text:', interactiveErr?.message || interactiveErr);
    // Plain text fallback — this always works as long as the token is valid
    const plainText = `I wasn't sure how to save that. Reply with a number:\n\n1️⃣ To-do\n2️⃣ Reminder\n3️⃣ Debt\n4️⃣ Deadline\n5️⃣ Important Date\n6️⃣ Watchlist\n7️⃣ Cancel`;
    const plainRes = await sendWhatsAppMessage(from, plainText);
    if (!plainRes || !plainRes.ok) {
      // Both failed — clear the pending intent to prevent the bot from locking up silently
      console.error('[WhatsApp Webhook] Plain text fallback also failed. Clearing pending intent to prevent silent lockup.');
      await clearPendingIntent(userId);
    }
  }
  return res.status(200).end();

  } catch (error) {
    console.error('Webhook processing error:', error);
    try { await sendWhatsAppMessage(from, "❌ Sorry, I encountered an internal error. Please try again."); } catch(e2) { console.error('Failed to send error message:', e2); }
    await ProcessedMessage.deleteOne({ messageId });
    return res.status(500).end();
  }
}

async function handleListQuery(userId, { module, sortBy = 'default', personFilter = null }, reply, envMode = 'live') {
  const envQuery = envMode === 'live'
    ? { userId, $or: [{ environmentMode: 'live' }, { environmentMode: { $exists: false } }] }
    : { userId, environmentMode: 'development' };

  if (module === 'debt') {
    let filter = { ...envQuery, settled: false };
    if (personFilter) {
      filter.person = new RegExp(personFilter, 'i');
    }
    let debts = await Debt.find(filter);

    if (!debts.length) {
      return reply(personFilter ? `No active debts found for "${personFilter}".` : 'No active debts found!');
    }

    if (sortBy === 'amount') {
      debts.sort((a, b) => b.amount - a.amount);
      const lines = debts.map((d, i) => {
        const dir = d.direction === 'i_owe' ? 'you owe' : 'owes you';
        return `${i + 1}. ${d.person} (${dir} ₹${d.amount})${d.note ? ` - ${d.note}` : ''}`;
      });
      return reply(`💰 Debts (Sorted by Amount):\n\n${lines.join('\n')}`);
    }

    if (sortBy === 'person') {
      const byPerson = {};
      debts.forEach(d => { byPerson[d.person] = byPerson[d.person] || []; byPerson[d.person].push(d); });
      const blocks = Object.entries(byPerson).map(([p, ds]) => formatDebt(p, ds));
      return reply(`💰 Debts (Grouped by Person):\n\n${blocks.join('\n')}`);
    }

    if (sortBy === 'time') {
      debts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const lines = debts.map((d, i) => {
        const dir = d.direction === 'i_owe' ? 'you owe' : 'owes you';
        return `${i + 1}. ${d.person} (${dir} ₹${d.amount}) — ${new Date(d.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
      });
      return reply(`💰 Debts (Sorted by Time):\n\n${lines.join('\n')}`);
    }

    const byPerson = {};
    debts.forEach(d => { byPerson[d.person] = byPerson[d.person] || []; byPerson[d.person].push(d); });
    const lines = Object.entries(byPerson).map(([p, ds]) => formatDebt(p, ds));
    return reply(`💰 Debts:\n\n${lines.join('\n')}`);
  }

  if (module === 'todo') {
    let todos = await Todo.find({ ...envQuery, status: 'open' });
    if (!todos.length) return reply('No open to-dos!');

    if (sortBy === 'priority') {
      const pOrder = { high: 1, medium: 2, low: 3 };
      todos.sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);
    } else if (sortBy === 'time' || sortBy === 'date') {
      todos.sort((a, b) => (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity));
    }

    return reply(`📋 Open To-Dos:\n\n${todos.map(formatTodo).join('\n')}`);
  }

  if (module === 'reminder') {
    let reminders = await Reminder.find({ ...envQuery, sent: false }).sort({ remindAt: 1 });
    if (!reminders.length) return reply('No upcoming reminders!');
    const lines = reminders.map((r, i) => `${i + 1}. ${r.title} — ${new Date(r.remindAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}`);
    return reply(`🔔 Upcoming Reminders:\n\n${lines.join('\n')}`);
  }

  if (module === 'deadline') {
    let deadlines = await Deadline.find(envQuery).sort({ dueDate: 1 });
    if (!deadlines.length) return reply('No deadlines!');
    const lines = deadlines.map((d, i) => `${i + 1}. ${d.title} — ${new Date(d.dueDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })} [${d.category}]`);
    return reply(`⏳ Deadlines:\n\n${lines.join('\n')}`);
  }

  if (module === 'date') {
    let dates = await ImportantDate.find(envQuery).sort({ date: 1 });
    if (!dates.length) return reply('No important dates!');
    const lines = dates.map((d, i) => `${i + 1}. ${d.title} — ${d.date}${d.recurring !== 'none' ? ` (${d.recurring})` : ''}`);
    return reply(`⭐ Important Dates:\n\n${lines.join('\n')}`);
  }

  if (module === 'watch') {
    let items = await WatchlistItem.find(envQuery).sort({ status: 1 });
    if (!items.length) return reply('Your watchlist is empty!');
    const lines = items.map((it, i) => `${i + 1}. ${it.title} [${it.type}] — ${it.status}${it.rating ? ` ★${it.rating}` : ''}`);
    return reply(`🎬 Watchlist:\n\n${lines.join('\n')}`);
  }
  return reply(`Unknown module list request. Try listing: todo, debt, reminder, deadline, date, or watch.`);
}

// Rebuild a synthetic command string from partial data + new answer
function buildSyntheticCommand(module, data) {
  switch (module) {
    case 'todo': return `>todo ${data.title || ''}${data.dueDate ? ` | ${data.dueDate}` : ''}`;
    case 'deadline': return `>deadline ${data.title || ''} | ${data.dueDate || ''} | ${data.category || 'personal'}`;
    case 'date': return `>date ${data.title || ''} | ${data.date || ''} | ${data.recurring || 'none'}`;
    case 'debt': return `>debt ${data.action || 'owe'} ${data.person || ''} ${data.amount || ''} ${data.note || ''}`;
    case 'watch': return `>watch ${data.title || ''}`;
    case 'done': return `>done ${data.query || ''}`;
    case 'list': return `>list ${data.module || ''}`;
    default: return `>${module} ${Object.values(data).join(' ')}`;
  }
}
