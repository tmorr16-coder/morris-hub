#!/usr/bin/env ruby
# Writes MorrisHealthSync.xcodeproj from the files in this folder.
#
# The project is committed, so nobody needs to run this to build the app.
# Run it again only after adding or removing a source file:
#
#   gem install xcodeproj && ruby generate-project.rb
#
# It works on Linux as well as macOS — it only writes the project file.

require "fileutils"
require "xcodeproj"

ROOT = __dir__
NAME = "MorrisHealthSync"
PATH = File.join(ROOT, "#{NAME}.xcodeproj")

FileUtils.rm_rf(PATH)
project = Xcodeproj::Project.new(PATH, false, 56)
target = project.new_target(:application, NAME, :ios, "17.0", nil, :swift)

# new_target links Foundation by a path inside one specific SDK version, which
# is a missing file on any other Xcode. Swift links system frameworks itself.
target.frameworks_build_phase.files.to_a.each(&:remove_from_project)
project.files.select { |f| f.path.to_s.end_with?(".framework") }.each(&:remove_from_project)
project.frameworks_group.recursive_children.reverse_each(&:remove_from_project)
project.frameworks_group.remove_from_project

sources = project.main_group.new_group("Sources", "Sources")
Dir.glob(File.join(ROOT, "Sources", "*.swift")).sort.each do |file|
  target.add_file_references([sources.new_file(File.basename(file))])
end
target.add_resources([sources.new_file("Assets.xcassets")])

config = project.main_group.new_group("Config", "Config")
config.new_file("Info.plist")
config.new_file("#{NAME}.entitlements")

target.build_configurations.each do |c|
  c.build_settings.merge!(
    "PRODUCT_BUNDLE_IDENTIFIER" => "family.morrisai.healthsync",
    "PRODUCT_NAME" => NAME,
    "MARKETING_VERSION" => "1.0",
    "CURRENT_PROJECT_VERSION" => "1",
    "INFOPLIST_FILE" => "Config/Info.plist",
    "GENERATE_INFOPLIST_FILE" => "NO",
    "CODE_SIGN_ENTITLEMENTS" => "Config/#{NAME}.entitlements",
    "CODE_SIGN_STYLE" => "Automatic",
    "SWIFT_VERSION" => "5.0",
    "SWIFT_STRICT_CONCURRENCY" => "minimal",
    "TARGETED_DEVICE_FAMILY" => "1",
    "IPHONEOS_DEPLOYMENT_TARGET" => "17.0",
    "ASSETCATALOG_COMPILER_APPICON_NAME" => "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME" => "AccentColor",
    "LD_RUNPATH_SEARCH_PATHS" => ["$(inherited)", "@executable_path/Frameworks"],
  )
end
project.build_configurations.each do |c|
  c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
end

project.save

# A shared scheme, so the Run button has something selected on first open.
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.set_launch_target(target)
scheme.save_as(PATH, NAME, true)

puts "Wrote #{PATH}"
