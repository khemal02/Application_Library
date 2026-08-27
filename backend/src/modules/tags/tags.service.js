const { Tag, Taggable } = require('../../models');

async function listAll(search) {
  const where = search ? { name: { [require('sequelize').Op.iLike]: `%${search}%` } } : {};
  return Tag.findAll({ where, order: [['name', 'ASC']], limit: 50 });
}

async function listForEntity(entityType, entityId) {
  const taggables = await Taggable.findAll({ where: { entityType, entityId }, include: [{ model: Tag, as: 'tag' }] });
  return taggables.map((t) => t.tag);
}

async function setForEntity(entityType, entityId, tagNames) {
  const tags = await Promise.all(
    tagNames.map(async (name) => {
      const [tag] = await Tag.findOrCreate({ where: { name: name.trim().toLowerCase() } });
      return tag;
    }),
  );
  await Taggable.destroy({ where: { entityType, entityId } });
  await Taggable.bulkCreate(tags.map((tag) => ({ tagId: tag.id, entityType, entityId })));
  return tags;
}

module.exports = { listAll, listForEntity, setForEntity };
