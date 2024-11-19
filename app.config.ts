import type { ExpoConfig } from "expo/config";

import { withAppBuildGradle, withAppDelegate, withMainApplication, withXcodeProject } from "expo/config-plugins";

// Regular expression to match the CLI_PATH block
const cliPathRegex = /if \[\[ -z "\$CLI_PATH" \]\]; then[\s\S]*?fi\n?/g;
// Regular expression to match the BUNDLE_COMMAND block
const bundleCommandRegex = /if \[\[ -z "\$BUNDLE_COMMAND" \]\]; then[\s\S]*?fi\n?/g;

function plugin(expo: ExpoConfig) {
	let res = expo;

	// iOS
	res = withXcodeProject(res, async (configuration) => {
		const xcodeProject = configuration.modResults;
		const bundleReactNativeCodeAndImagesBuildPhase = xcodeProject.buildPhaseObject(
			"PBXShellScriptBuildPhase",
			"Bundle React Native code and images",
		);

		if (!bundleReactNativeCodeAndImagesBuildPhase)
			return configuration;

		const script = JSON.parse(bundleReactNativeCodeAndImagesBuildPhase.shellScript);
		const patched = script.replace(cliPathRegex, "").replace(bundleCommandRegex, "");

		bundleReactNativeCodeAndImagesBuildPhase.shellScript = JSON.stringify(patched);
		return configuration;
	});

	res = withAppDelegate(res, async (configuration) => {
		const appDelegate = configuration.modResults.contents;
		configuration.modResults.contents = appDelegate.replace(".expo/.virtual-metro-entry", "index");

		return configuration;
	});

	// Android
	res = withMainApplication(res, async (configuration) => {
		const mainApplication = configuration.modResults.contents;
		configuration.modResults.contents = mainApplication.replace(".expo/.virtual-metro-entry", "index");

		return configuration;
	});

	res = withAppBuildGradle(res, async (config) => {
		const buildGradle = config.modResults.contents;
		const patched = buildGradle.replace(/cliFile.*/, "").replace(/bundleCommand.*/, "");

		config.modResults.contents = patched;
		return config;
	});

	return res;
}


export default {
	name: "Repro",
	slug: "repro",
	scheme: "repro",
	platforms: [
		"ios",
		"android",
	],
	newArchEnabled: true,
	android: {
		package: "com.example.repro",
	},
	ios: {
		bundleIdentifier: "com.example.repro",
	},
	plugins: [
		plugin as any,
	],
} as ExpoConfig;
