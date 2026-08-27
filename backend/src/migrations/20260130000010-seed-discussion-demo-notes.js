'use strict';
const { v4: uuidv4 } = require('uuid');

// Demo content for the new "Discussion" panel (NotesThread) on Ideas and Suggestions — a handful
// of realistic multi-person entries so the feature doesn't look empty out of the box. Looks up
// the already-seeded demo ideas/suggestions/users by their fixed titles/emails rather than
// importing seeders/helpers/refs, since those UUIDs are regenerated per db:seed:all run and
// won't match rows already persisted from an earlier seed.
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [ideas] = await queryInterface.sequelize.query("SELECT id, title FROM ideas");
    const [suggestions] = await queryInterface.sequelize.query("SELECT id, title FROM application_suggestions");
    const [users] = await queryInterface.sequelize.query("SELECT id, email FROM users");
    if (!ideas.length && !suggestions.length) return;

    const userByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
    const ideaByTitle = Object.fromEntries(ideas.map((i) => [i.title, i.id]));
    const suggestionByTitle = Object.fromEntries(suggestions.map((s) => [s.title, s.id]));

    const rows = [];
    const addNote = (entityType, entityId, email, body, minutesAgo) => {
      if (!entityId || !userByEmail[email]) return;
      rows.push({
        id: uuidv4(), entity_type: entityType, entity_id: entityId, user_id: userByEmail[email], body,
        created_at: new Date(now.getTime() - minutesAgo * 60000), updated_at: new Date(now.getTime() - minutesAgo * 60000),
      });
    };

    addNote('idea_note', ideaByTitle['AI-assisted meeting notes summarizer'], 'employee5@aams.local',
      'Talked to two managers already — both said transcription accuracy on accented speech is their biggest worry. Worth a quick spike before committing to Whisper.', 240);
    addNote('idea_note', ideaByTitle['AI-assisted meeting notes summarizer'], 'employee2@aams.local',
      "Good call. I can put together a short accuracy comparison against 3-4 real recordings from last week's syncs.", 180);

    addNote('idea_note', ideaByTitle['Internal AI code review assistant'], 'employee3@aams.local',
      'One risk: if the bot leaves noisy comments on every PR, people will just start ignoring it. Suggest we start with a "suggest only, don\'t block" mode.', 200);
    addNote('idea_note', ideaByTitle['Internal AI code review assistant'], 'teamlead@aams.local',
      "Agreed — let's pilot on the platform repo only for the first month and track false-positive rate before rolling out wider.", 150);

    addNote('idea_note', ideaByTitle['Expense report anomaly detector'], 'employee1@aams.local',
      'Finance flagged that they need an audit trail for every auto-flagged item, not just a score — adding that to the proposed solution.', 90);

    addNote('suggestion_note', suggestionByTitle['Cache classification results for duplicate ticket bodies'], 'employee4@aams.local',
      "Confirmed with the support team — roughly 18% of tickets last month were near-duplicates within a 24h window, so the cache window checks out.", 220);
    addNote('suggestion_note', suggestionByTitle['Cache classification results for duplicate ticket bodies'], 'manager@aams.local',
      'Make sure the cache key strips customer PII before hashing — flagging this for the security review step.', 160);

    addNote('suggestion_note', suggestionByTitle['Add Kanban board view for suggestions'], 'ceo@aams.local',
      "I'd like to see this prioritized — the flat list view is the #1 complaint I hear from reviewers.", 100);
    addNote('suggestion_note', suggestionByTitle['Add Kanban board view for suggestions'], 'admin@aams.local',
      'Can reuse the existing status_history data directly for the column transitions, so this should be lower effort than it looks.', 60);

    if (rows.length) await queryInterface.bulkInsert('comments', rows);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("DELETE FROM comments WHERE entity_type IN ('idea_note', 'suggestion_note')");
  },
};
