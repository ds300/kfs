set -e

yarn clean
yarn pack
file="kfs-fs*.tgz"
hash=$(cat $file | md5)
mv $file kfs-fs.$hash.tgz
