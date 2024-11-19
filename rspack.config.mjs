import { createRequire } from "node:module";
import { join } from "node:path";

import * as Repack from "@callstack/repack";
import { DefinePlugin } from "@rspack/core";

const dirname = Repack.getDirname(import.meta.url);
const require = createRequire(import.meta.url);

/**
 * @param {import("@rspack/core").RuleSetRule} rule
 *
 * @returns {import("@rspack/core").RuleSetRule} rule
 */
function addBabelToRule(rule) {
	return {
		...rule,
		rules: rule.rules.map(item => ({
			...item,
			use: [{ loader: "babel-loader" }, ...item.use],
		})),
	};
}

export default ({
	mode = "development",
	context = dirname,
	entry = "./src/index.ts",
	platform = process.env.PLATFORM,
	minimize = mode === "production",
	devServer = undefined,
	bundleFilename = undefined,
	sourceMapFilename = undefined,
	assetsPath = undefined,
	reactNativePath = require.resolve("react-native"),
}) => {
	if (!platform) throw new Error("Missing platform");

	process.env.NATIVEWIND_OS = platform === "web" ? "web" : "native";

	return {
		mode,
		/**
		 * This should be always `false`, since the Source Map configuration is done
		 * by `SourceMapDevToolPlugin`.
		 */
		devtool: false,
		context,
		entry,
		resolve: {
			/**
			 * `getResolveOptions` returns additional resolution configuration for React Native.
			 * If it's removed, you won't be able to use `<file>.<platform>.<ext>` (eg: `file.ios.js`)
			 * convention and some 3rd-party libraries that specify `react-native` field
			 * in their `package.json` might not work correctly.
			 */
			...Repack.getResolveOptions(platform),

			/**
			 * Uncomment this to ensure all `react-native*` imports will resolve to the same React Native
			 * dependency. You might need it when using workspaces/monorepos or unconventional project
			 * structure. For simple/typical project you won't need it.
			 */
			alias: {
				"react-native": reactNativePath,
			},
		},
		/**
		 * Configures output.
		 * It's recommended to leave it as it is unless you know what you're doing.
		 * By default Webpack will emit files into the directory specified under `path`. In order for the
		 * React Native app use them when bundling the `.ipa`/`.apk`, they need to be copied over with
		 * `Repack.OutputPlugin`, which is configured by default inside `Repack.RepackPlugin`.
		 */
		output: {
			clean: true,
			hashFunction: "xxhash64",
			path: join(dirname, "build/generated", platform),
			filename: "index.bundle",
			chunkFilename: "[name].chunk.bundle",
			publicPath: Repack.getPublicPath({ platform, devServer }),
		},
		/** Configures optimization of the built bundle. */
		optimization: {
			/** Enables minification based on values passed from React Native Community CLI or from fallback. */
			minimize,
			/** Configure minimizer to process the bundle. */
			chunkIds: "named",
		},
		module: {
			rules: [
				Repack.REACT_NATIVE_LOADING_RULES,
				addBabelToRule(Repack.NODE_MODULES_LOADING_RULES),
				Repack.FLOW_TYPED_MODULES_LOADING_RULES,
				/** Here you can adjust loader that will process your files. */
				{
					test: /\.[jt]sx?$/,
					exclude: [/node_modules/],
					type: "javascript/auto",
					use: [
						{ loader: "babel-loader" },
						{
							loader: "builtin:swc-loader",
							/** @type {import('@rspack/core').SwcLoaderOptions} */
							options: {
								env: {
									targets: {
										"react-native": "0.76",
									},
								},
								jsc: {
									externalHelpers: true,
									transform: {
										react: {
											runtime: "automatic",
											development: mode === "development",
											refresh: mode === "development" && Boolean(devServer),
										},
									},
								},
							},
						},
					],
				},
				/** Run React Native codegen, required for utilizing new architecture */
				Repack.REACT_NATIVE_CODEGEN_RULES,

				/**
				 * This loader handles all static assets (images, video, audio and others), so that you can
				 * use (reference) them inside your application.
				 *
				 * If you want to handle specific asset type manually, filter out the extension
				 * from `ASSET_EXTENSIONS`, for example:
				 * ```
				 * Repack.ASSET_EXTENSIONS.filter((ext) => ext !== 'svg')
				 * ```
				 */
				{
					test: Repack.getAssetExtensionsRegExp(Repack.ASSET_EXTENSIONS),
					use: {
						loader: "@callstack/repack/assets-loader",
						options: {
							platform,
							devServerEnabled: Boolean(devServer),
						},
					},
				},
			],
		},
		plugins: [
			/**
			 * Configure other required and additional plugins to make the bundle
			 * work in React Native and provide good development experience with
			 * sensible defaults.
			 *
			 * `Repack.RepackPlugin` provides some degree of customization, but if you
			 * need more control, you can replace `Repack.RepackPlugin` with plugins
			 * from `Repack.plugins`.
			 */
			new Repack.RepackPlugin({
				context,
				mode,
				platform,
				devServer,
				output: {
					bundleFilename,
					sourceMapFilename,
					assetsPath,
				},
			}),

			new DefinePlugin({
				"process.env.EXPO_OS": JSON.stringify(platform),
			}),
		],
	};
};
