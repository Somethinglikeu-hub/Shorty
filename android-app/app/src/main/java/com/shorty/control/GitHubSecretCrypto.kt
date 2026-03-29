package com.shorty.control

import android.util.Base64
import com.iwebpp.crypto.TweetNaclFast
import org.bouncycastle.crypto.digests.Blake2bDigest

object GitHubSecretCrypto {
    fun encryptForGitHub(publicKeyBase64: String, value: String): String {
        val repositoryPublicKey = Base64.decode(publicKeyBase64, Base64.DEFAULT)
        val ephemeralKeyPair = TweetNaclFast.Box.keyPair()
        val ephemeralPublicKey = ephemeralKeyPair.publicKey
        val ephemeralSecretKey = ephemeralKeyPair.secretKey
        val nonce = ByteArray(TweetNaclFast.Box.nonceLength)
        val nonceDigest = Blake2bDigest(TweetNaclFast.Box.nonceLength * 8)

        nonceDigest.update(ephemeralPublicKey, 0, ephemeralPublicKey.size)
        nonceDigest.update(repositoryPublicKey, 0, repositoryPublicKey.size)
        nonceDigest.doFinal(nonce, 0)

        val box = TweetNaclFast.Box(repositoryPublicKey, ephemeralSecretKey)
        val cipherText = box.box(value.toByteArray(Charsets.UTF_8), nonce)
            ?: throw IllegalStateException("Failed to encrypt GitHub secret.")

        val sealedBox = ByteArray(ephemeralPublicKey.size + cipherText.size)
        System.arraycopy(ephemeralPublicKey, 0, sealedBox, 0, ephemeralPublicKey.size)
        System.arraycopy(cipherText, 0, sealedBox, ephemeralPublicKey.size, cipherText.size)
        return Base64.encodeToString(sealedBox, Base64.NO_WRAP)
    }
}
