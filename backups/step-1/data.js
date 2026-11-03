/*
  data.js — builds one invented month (October 2026) of messy Brightpath data
  from the four sources the program director uses today.
  Everything here is made up. No real people.

  makeSampleMonth() returns:
    forms:   Google Forms signups (one row per signup, with duplicates and blanks)
    sheet:   shared attendance spreadsheet (attended Y/N in many spellings, hours, dates)
    emails:  volunteer emails (free text with hours, dates and stories)
    donors:  donor database export (cryptic column names, amounts in mixed formats)
*/

function makeRng(seed) {
  // Small repeatable random generator, so the sample month is the same every time.
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ana', 'Marcus', 'Priya', 'Deshawn', 'Lin', 'Fatima', 'Jorge', 'Keisha', 'Tomas', 'Aisha',
  'Rosa', 'Kwame', 'Mei', 'Dmitri', 'Imani', 'Luis', 'Hana', 'Andre', 'Sofia', 'Omar', 'Grace', 'Malik',
  'Elena', 'Tariq', 'Nadia', 'Samuel', 'Yara', 'Victor', 'Leah', 'Ravi', 'Carmen', 'Jamal', 'Ines', 'Kofi'];
const LAST = ['Rivera', 'Okafor', 'Nguyen', 'Patel', 'Johnson', 'Haddad', 'Kim', 'Moreno', 'Brooks', 'Silva',
  'Abebe', 'Chen', 'Walker', 'Santos', 'Ibrahim', 'Novak', 'Mensah', 'Torres', 'Lee', 'Castillo', 'Osei',
  'Reyes', 'Hughes', 'Farah', 'Park', 'Delgado', 'Bennett', 'Ruiz', 'Adeyemi', 'Flores', 'Kowalski', 'Diaz'];
const PROGRAMS = ['After-school mentoring', 'Weekend tutoring', 'Family nights', 'Summer bridge'];
const MENTORS = ['Dana P.', 'Chris L.', 'Jess M.', 'Sam R.', 'Alex T.', 'Morgan K.', 'Jordan B.', 'Riley S.',
  'Taylor W.', 'Casey H.', 'Jamie F.', 'Quinn D.'];

const STORY_LINES = [
  'Mateo finally read a whole chapter book out loud — his mom cried a little.',
  'The Okafor twins asked if mentoring could be twice a week. Big change from September!',
  'Leila\'s math grade went from a D to a B-. She showed me the test before saying hi.',
  'A dad stayed after family night to sign up as a volunteer driver.',
  'Jayden has not missed one session since we started doing homework snacks.',
  'Two siblings who barely talked in week 1 led the group game today.',
  'Amira got into the after-school robotics club — she credits our Tuesday sessions.',
  'Grandma Rosa said this is the only evening the kids put their phones down.',
];

function pick(rng, list) { return list[Math.floor(rng() * list.length)]; }
function pad(n, w) { return String(n).padStart(w, '0'); }

// The same date written the way different volunteers actually write dates.
function messyDate(rng, day) {
  const r = rng();
  if (r < 0.45) return `2026-10-${pad(day, 2)}`;
  if (r < 0.75) return `10/${day}/2026`;
  if (r < 0.88) return `Oct ${day}`;
  if (r < 0.94) return `${day}.10.26`;
  return '';
}

// "Attended?" written many different ways. Blank means nobody marked it.
function messyAttended(rng, showed) {
  if (rng() < 0.05) return '';
  if (showed) return pick(rng, ['Y', 'Y', 'yes', 'Yes ', 'x', '✓', 'attended', 'TRUE']);
  return pick(rng, ['N', 'N', 'no', 'no show', 'NS', 'didnt come', 'FALSE']);
}

function messyHours(rng) {
  const r = rng();
  if (r < 0.08) return '';
  if (r < 0.11) return '?';
  const h = pick(rng, [1, 1.5, 2, 2, 2.5, 3]);
  if (r < 0.75) return String(h);
  if (r < 0.9) return `${h} hrs`;
  return `${h}h`;
}

// Small typing mistakes, so the same family looks like two different people.
function typo(rng, name) {
  const r = rng();
  if (r < 0.3) return name.toUpperCase();
  if (r < 0.55) return '  ' + name.toLowerCase() + ' ';
  if (r < 0.8 && name.length > 4) { // swap two letters
    const i = 1 + Math.floor(rng() * (name.length - 3));
    return name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2);
  }
  return name.replace(' ', '  ');
}

function makeSampleMonth() {
  const rng = makeRng(20261031);
  const FAMILY_COUNT = 11900; // unique families who signed up (about 2 in 3 will show up)

  const families = [];
  for (let i = 0; i < FAMILY_COUNT; i++) {
    const first = pick(rng, FIRST);
    const last = pick(rng, LAST);
    families.push({
      id: 'BP-' + pad(10000 + i, 5),
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.org`.toLowerCase(),
      phone: `555-${pad(Math.floor(rng() * 1000), 3)}-${pad(Math.floor(rng() * 10000), 4)}`,
      zip: pick(rng, ['48104', '48105', '48108', '48197', '48198']),
      kids: 1 + Math.floor(rng() * 4),
      program: pick(rng, PROGRAMS),
      showed: rng() < 0.67,
    });
  }

  // 1) Google Forms signups
  const forms = [];
  for (const f of families) {
    const day = 1 + Math.floor(rng() * 28);
    forms.push({
      'Timestamp': `10/${day}/2026 ${7 + Math.floor(rng() * 12)}:${pad(Math.floor(rng() * 60), 2)}`,
      'Parent/guardian name': f.name,
      'Email': rng() < 0.04 ? '' : f.email,
      'Phone': rng() < 0.06 ? '' : f.phone,
      'ZIP': rng() < 0.03 ? '' : f.zip,
      'How many kids?': rng() < 0.03 ? '' : String(f.kids),
      'Program': f.program,
    });
    if (rng() < 0.07) { // same family submitted the form again
      forms.push({
        'Timestamp': `10/${Math.min(28, day + 1 + Math.floor(rng() * 3))}/2026 ${8 + Math.floor(rng() * 10)}:05`,
        'Parent/guardian name': typo(rng, f.name),
        'Email': rng() < 0.5 ? f.email.toUpperCase() : '',
        'Phone': f.phone,
        'ZIP': f.zip,
        'How many kids?': rng() < 0.2 ? 'two' : String(f.kids),
        'Program': f.program,
      });
    }
  }

  // 2) Shared attendance spreadsheet
  const sheet = [];
  for (const f of families) {
    if (rng() < 0.04) continue; // family never made it onto the sheet
    const day = 1 + Math.floor(rng() * 30);
    const row = {
      'Family ID': rng() < 0.12 ? '' : f.id,
      'Family': rng() < 0.15 ? typo(rng, f.name) : f.name,
      'Session date': messyDate(rng, day),
      'Attended?': messyAttended(rng, f.showed),
      'Mentor': f.showed ? pick(rng, MENTORS) : '',
      'Volunteer hrs': f.showed ? messyHours(rng) : '',
    };
    sheet.push(row);
    if (rng() < 0.05) sheet.push({ ...row, 'Family ID': '', 'Mentor': row['Mentor'].toLowerCase() }); // entered twice
  }

  // 3) Volunteer emails
  const emails = [];
  for (let i = 0; i < 42; i++) {
    const m = pick(rng, MENTORS);
    const day = 1 + Math.floor(rng() * 30);
    const fam = pick(rng, families).name.split(' ')[1];
    const hrs = pick(rng, ['2', '3', '1.5', 'about 4', 'two', '']);
    const hoursText = hrs ? `Logged ${hrs} hours` : 'Forgot to log my hours, sorry';
    const story = rng() < 0.55 ? ' ' + pick(rng, STORY_LINES) : '';
    emails.push({
      from: m,
      subject: pick(rng, ['hours', 'Re: Re: October hours??', 'quick update', 'FW: sessions', '(no subject)']),
      body: `Hi Dana — ${hoursText} with the ${fam} family on ${messyDate(rng, day) || 'last Tuesday'}.${story} Thanks! ${m}`,
    });
  }

  // 4) Donor database export (the one only two people understand)
  const donors = [];
  for (let i = 0; i < 260; i++) {
    const amt = pick(rng, [25, 50, 100, 100, 250, 500, 1000, 2500, 10000]);
    const r = rng();
    donors.push({
      'DNR_ID': 'D' + pad(4000 + Math.floor(rng() * 900), 4),
      'DNR_NM': rng() < 0.1 ? 'ANON' : `${pick(rng, LAST)} ${pick(rng, ['Family', 'Foundation', 'Fund', 'LLC', ''])}`.trim(),
      'GFT_AMT': r < 0.5 ? amt.toFixed(2) : r < 0.8 ? '$' + amt.toLocaleString('en-US') : r < 0.95 ? String(amt) : '',
      'GFT_DT': messyDate(rng, 1 + Math.floor(rng() * 30)),
      'FND_CD': pick(rng, ['GEN', 'GEN', 'YTH-MNT', 'YTH-MNT', 'RESTR-23', 'EVT']),
    });
  }

  return { forms, sheet, emails, donors };
}
