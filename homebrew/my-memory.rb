cask "my-memory" do
  version "1.0.0"
  sha256 "TEMPLATE_SHA256_REPLACE_ON_RELEASE"

  url "https://github.com/ShubhenduVaid/my-memory/releases/download/v#{version}/My-Memory-#{version}.dmg"
  name "My Memory"
  desc "Search your notes by meaning, not keywords"
  homepage "https://github.com/ShubhenduVaid/my-memory"

  depends_on macos: ">= :monterey"

  app "My Memory.app"

  zap trash: [
    "~/Library/Application Support/my-memory",
    "~/Library/Preferences/com.shubhenduvaid.my-memory.plist",
    "~/Library/Caches/com.shubhenduvaid.my-memory"
  ]
end
