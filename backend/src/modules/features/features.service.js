const { createCrudService } = require('../../utils/crudFactory');
const { ApplicationFeature, FeatureDependency, User } = require('../../models');

const include = [
  { model: User, as: 'assignedDeveloper', attributes: ['id', 'name', 'avatarUrl'] },
  { model: FeatureDependency, as: 'dependencies' },
];

const base = createCrudService(ApplicationFeature, {
  searchableFields: ['name'],
  filterableFields: ['applicationId', 'status', 'assignedDeveloperId'],
  include,
  notFoundMessage: 'Feature not found',
});

async function syncDependencies(featureId, dependencyIds = []) {
  await FeatureDependency.destroy({ where: { featureId } });
  if (dependencyIds.length) {
    await FeatureDependency.bulkCreate(dependencyIds.map((dependsOnFeatureId) => ({ featureId, dependsOnFeatureId })));
  }
}

async function create(payload) {
  const { dependencyIds, ...rest } = payload;
  const feature = await ApplicationFeature.create(rest);
  if (dependencyIds) await syncDependencies(feature.id, dependencyIds);
  return base.getById(feature.id);
}

async function update(id, payload) {
  const { dependencyIds, ...rest } = payload;
  const feature = await base.update(id, rest);
  if (dependencyIds) await syncDependencies(feature.id, dependencyIds);
  return base.getById(feature.id);
}

module.exports = { ...base, create, update };
