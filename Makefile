PKGNAME := doubao-voice-input-electron
PKGVER := 0.1.0
PKGREL := 1

PKGFILE_APPIMAGE := $(PKGNAME)-$(PKGVER).AppImage
PKGFILE_DEB := $(PKGNAME)_$(PKGVER)_amd64.deb
PKGFILE_PKGBUILD := $(PKGNAME)-bin-$(PKGVER)-$(PKGREL)-x86_64.pkg.tar.zst

.PHONY: build-linux-all build-linux-npm build-linux-pkgbuild clean

build-linux-all: build-linux-npm build-linux-pkgbuild

build-linux-npm:
	CFLAGS="-Wno-error=implicit-function-declaration" pnpm run build:linux

build-linux-pkgbuild:
	cp dist/$(PKGFILE_DEB) pkg/pkgbuild/
	cd pkg/pkgbuild && makepkg -f
	mv pkg/pkgbuild/$(PKGFILE_PKGBUILD) dist/
	rm -f pkg/pkgbuild/$(PKGFILE_DEB)

clean:
	rm -rf dist out
	rm -rf pkg/pkgbuild/pkg pkg/pkgbuild/src
	rm -f pkg/pkgbuild/$(PKGFILE_PKGBUILD) pkg/pkgbuild/$(PKGFILE_DEB)
