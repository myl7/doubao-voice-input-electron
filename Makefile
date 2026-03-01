VERSION := 0.1.0
PKG_NAME := doubao-voice-input-electron

.PHONY: build build-linux build-pkgbuild build-all clean

build-all: build-linux build-pkgbuild

build:
	pnpm run build

build-linux:
	CFLAGS="-Wno-error=implicit-function-declaration" pnpm run build:linux

build-pkgbuild: build-linux
	cp "dist/$(PKG_NAME)-$(VERSION).deb" "pkg/arch/$(PKG_NAME)-$(VERSION).deb"
	cd pkg/arch && makepkg -f
	mv pkg/arch/*.pkg.tar.zst dist/
	rm -f pkg/arch/*.deb

clean:
	rm -rf dist out
	rm -f pkg/arch/*.pkg.tar.zst pkg/arch/*.deb
	rm -rf pkg/arch/pkg pkg/arch/src
