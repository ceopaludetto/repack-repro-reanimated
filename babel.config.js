/**
 *
 * @param {import("@babel/core").ConfigAPI} api
 * @returns {import("@babel/core").TransformOptions} configuration
 */
module.exports = (api) => {
	api.cache(true);

	return {
		plugins: [["react-native-reanimated/plugin", { processNestedWorklets: true }]],
	};
};
