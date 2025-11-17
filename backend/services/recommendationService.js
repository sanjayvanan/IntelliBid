// services/recommendationService.js
const itemService = require("./itemService");
// const aiService = require("./aiService"); // keep if we re-enable LLM re-ranking



/**
 * Returns full item objects for the best recommendations of a given item.
 * Current strategy: pure pgvector similarity (top 4).
 */
const getRecommendationsForItem = async (itemId) => {
  const { candidates } = await itemService.getRecommendationBaseData(
    itemId,
    20
  );

  if (!candidates.length) {
    return [];
  }

  // Pure vector mode: just take the top 4 similar items
  return candidates.slice(0, 4);

  /*
  // LLM ranking and recommendation

  const currentItem = (await itemService.getItemById(itemId)) || {};
  const candidatesList = candidates.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.current_price,
  }));

  const recommendedIds = await aiService.chooseRecommendedIds(
    currentItem,
    candidatesList
  );

  const recommended = candidates.filter((item) =>
    recommendedIds.includes(item.id)
  );

  if (!recommended.length) {
    return candidates.slice(0, 3);
  }

  return recommended;
  */
};

module.exports = {
  getRecommendationsForItem,
};
