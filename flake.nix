{
  description = "Personal AI Infrastructure — Nix bootstrap";

  inputs = {
    nixpkgs.url     = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        deps = with pkgs; [ bun curl rsync git bash ];

        # README "Manual install (clone + run)":
        #   cp -R Releases/v5.0.0/.claude ~/
        #   cd ~/.claude && ./install.sh
        inner = pkgs.writeShellApplication {
          name          = "pai-bootstrap";
          runtimeInputs = deps;
          text = ''
            if [ -e "$HOME/.claude" ]; then
              BACKUP="$HOME/.claude.backup-$(date +%Y%m%d-%H%M%S)"
              mv "$HOME/.claude" "$BACKUP"
              echo "Existing \$HOME/.claude moved to $BACKUP"
            fi
            cp -R ${self}/Releases/v5.0.0/.claude "$HOME/.claude"
            chmod -R u+w "$HOME/.claude"
            cd "$HOME/.claude"
            exec bash ./install.sh "$@"
          '';
        };

        # Linux (incl. WSL): FHS chroot so PAI's bundled Electron GUI installer
        # finds libglib-2.0 / GTK / NSS / etc.  macOS: native frameworks ship
        # with Electron, no wrap needed.
        bootstrap =
          if pkgs.stdenv.isLinux then
            pkgs.buildFHSEnv (pkgs.appimageTools.defaultFhsEnvArgs // {
              name       = "pai-bootstrap";
              targetPkgs = p: pkgs.appimageTools.defaultFhsEnvArgs.targetPkgs p ++ deps;
              runScript  = "${inner}/bin/pai-bootstrap";
            })
          else
            inner;

        # `nix develop` — same toolchain + FHS shape as the installer, for
        # working on PAI's source itself (running Electron, bun, hooks).
        devShell =
          if pkgs.stdenv.isLinux then
            (pkgs.buildFHSEnv (pkgs.appimageTools.defaultFhsEnvArgs // {
              name       = "pai-dev";
              targetPkgs = p: pkgs.appimageTools.defaultFhsEnvArgs.targetPkgs p ++ deps;
              runScript  = "bash";
            })).env
          else
            pkgs.mkShell { packages = deps; };
      in {
        packages.default = bootstrap;
        apps.default     = { type = "app"; program = "${bootstrap}/bin/pai-bootstrap"; };
        devShells.default = devShell;
      });
}
