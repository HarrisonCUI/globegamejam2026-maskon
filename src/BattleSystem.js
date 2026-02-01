export class BattleSystem {

    constructor(ui) {
        this.ui = ui;
        this.state = 'MENU'; // IDLE, ENEMY_ATTACK, PLAYER_STUNNED, PLAYER_ATTACK, MENU
        this.playerHP = 100;
        this.enemyHP = 500;
        this.enemyMaxHP = 500;

        // Cooldowns
        this.lastActionTime = 0;
        this.lastUltimateTime = 0; // Track Ultimate Cooldown
        this.attackDuration = 2000;


        this.dizzyDuration = 3000;

        this.comboCount = 0;
        this.lastHitTime = 0;
    }

    get isActive() {
        return this.state !== 'MENU';
    }


    start(mode, level = 'STREET', difficulty = 'EASY') {
        this.state = 'IDLE';
        this.difficulty = difficulty;

        this.playerHP = 100;

        // HP Scaling
        this.enemyMaxHP = (difficulty === 'HARD') ? 1000 : 500;
        this.enemyHP = this.enemyMaxHP;

        this.comboCount = 0;
        this.ui.updateCombo(0);
        this.ui.updateHealth(100, this.enemyHP, this.enemyMaxHP);

        // Define Assets based on Level
        if (level === 'OFFICE') {
            this.assets = {
                normal: new URL('./assets/character/boss/boss-normal.png', import.meta.url).href,
                attack: new URL('./assets/character/boss/boss-attack.png', import.meta.url).href,
                hurt: new URL('./assets/character/boss/boss-hurt.png', import.meta.url).href,
                win: new URL('./assets/character/boss/win.png', import.meta.url).href, // Boss Wins
                lose: new URL('./assets/character/boss/boss-fail.png', import.meta.url).href, // Boss Loses
                skills: [
                    new URL('./assets/character/boss/skill1.png', import.meta.url).href,
                    new URL('./assets/character/boss/skill2.png', import.meta.url).href,
                    new URL('./assets/character/boss/skill3.png', import.meta.url).href
                ]
            };
            this.ui.updateBossName("ANNOYING BOSS"); // Optional name change
        } else {
            // Default STREET / Auntie
            this.assets = {
                normal: new URL('./assets/character/aunt/level1-character-normal.png', import.meta.url).href,
                attack: new URL('./assets/character/aunt/aunt-attack.png', import.meta.url).href,
                hurt: new URL('./assets/character/aunt/aunt-hurt.png', import.meta.url).href,
                win: new URL('./assets/character/aunt/level1-character_win.png', import.meta.url).href,
                lose: new URL('./assets/character/aunt/level1-character_lose.png', import.meta.url).href,
                skills: null
            };
            this.ui.updateBossName("TOXIC AUNTIE");
        }

        this.ui.setBossImage(this.assets.normal);
        console.log("BattleSystem: START called. Mode:", mode, "Level:", level, "Diff:", difficulty);
        this.nextAttackTime = null; // FORCE RESET TIMER
    }


    update(timestamp) {
        if (this.state === 'MENU' || this.state === 'VICTORY') return;

        // Aggressive AI Timer Logic
        if (this.state === 'IDLE') {
            if (!this.nextAttackTime) {
                this.scheduleNextAttack();
            }

            if (Date.now() >= this.nextAttackTime) {
                this.startEnemyAttack();
            }
        }
    }

    scheduleNextAttack() {
        let delay;
        if (this.difficulty === 'HARD') {
            // Faster Attacks: 0.8s to 2s
            delay = 800 + Math.random() * 1200;
        } else {
            // Easy/Normal: 2s to 4s
            delay = 2000 + Math.random() * 2000;
        }

        this.nextAttackTime = Date.now() + delay;
    }

    startEnemyAttack() {
        this.state = 'ENEMY_ATTACK';
        this.ui.showFeedback("ATTACKING!", "red");

        // Determine Attack Type
        // If Boss (has skills), 40% chance of Special Skill, 60% Normal Attack
        const useSpecial = this.assets.skills && Math.random() < 0.4;

        // Handle Animation
        if (useSpecial) {
            this.ui.showFeedback("SPECIAL ART!", "purple");
            // Play Skill Sequence (Spread over 1400ms)
            // 0ms: Skill 1
            // 400ms: Skill 2
            // 800ms: Skill 3
            this.ui.setBossImage(this.assets.skills[0]);
            setTimeout(() => { if (this.state === 'ENEMY_ATTACK') this.ui.setBossImage(this.assets.skills[1]); }, 400);
            setTimeout(() => { if (this.state === 'ENEMY_ATTACK') this.ui.setBossImage(this.assets.skills[2]); }, 800);
        } else {
            // Standard static attack image (Normal Attack)
            this.ui.setBossImage(this.assets.attack);
        }

        // Trigger Visuals
        // If we have custom skills (Boss), don't show the generic Auntie Hand overlay
        const showHand = !this.assets.skills;
        this.ui.playBossSlapAnimation(showHand);

        // Reset next attack timer
        this.nextAttackTime = null;

        // Logic to check dodge within X seconds
        // Slower Attack -> Longer window
        setTimeout(() => this.resolveEnemyAttack(), 1400); // 1.4s (Near end of anim)
    }







    onSlap(slapDirection) {
        // Player attacks
        if (this.state === 'IDLE') {
            // Boss Evasion Chance (30%)
            if (Math.random() < 0.3) {
                const dodgeDirection = Math.random() < 0.5 ? 'left' : 'right';

                // Check if Player caught the dodge
                // Note: Slap Left (deltaX < 0) vs Dodge Left (translateX < 0)
                // If directions match, it's a hit!
                if (slapDirection === dodgeDirection) {
                    this.ui.showFeedback("GOTCHA!", "cyan");
                    this.ui.playBossDodgeAnimation(dodgeDirection); // Still animates, but gets hit
                    // Proceed to damage below
                } else {
                    this.ui.playBossDodgeAnimation(dodgeDirection);

                    this.ui.playBossDodgeAnimation(dodgeDirection);
                    this.ui.showFeedback("MISSED!", "orange");
                    this.comboCount = 0;
                    this.ui.updateCombo(0);
                    return; // Attack avoided
                }
            }



            this.enemyHP -= 5;
            // this.ui.showFeedback("SLAP! -5 HP", "red"); // Replaced by floating text
            this.ui.updateHealth(this.playerHP, this.enemyHP, this.enemyMaxHP);

            // HURT Animation
            this.ui.setBossImage(this.assets.hurt);
            setTimeout(() => {
                if (this.state === 'IDLE') { // Don't override if state changed
                    this.ui.setBossImage(this.assets.normal);
                }
            }, 500);

            // Calculate Pitch based on combo (Cap at 2.0x)
            const pitch = 1 + Math.min(this.comboCount, 10) * 0.1;
            this.ui.playSlapSound(pitch);


            // JUICE
            this.ui.triggerFlash();
            this.ui.triggerScreenShake();

            // Particles & Text (Center screen for now, ideally hit loc)
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2 - 50;
            this.ui.spawnParticles(centerX, centerY, '#e74c3c'); // Red blood particles? Or Gold sparks?
            this.ui.showDamageText(`-5`, centerX, centerY - 100, '#ff4757');

            // COMBO Logic
            const now = Date.now();
            if (now - this.lastHitTime < 2000) {
                this.comboCount++;
            } else {
                this.comboCount = 1;
            }
            this.lastHitTime = now;
            this.ui.updateCombo(this.comboCount);


            if (this.enemyHP <= 0) {
                this.onWin();
            }

        }
    }

    onUltimate() {
        const now = Date.now();
        if (now - this.lastUltimateTime < 10000) { // 10s Cooldown
            // Optional: Feedback for charging
            // this.ui.showFeedback("CHARGING...", "gray");
            return;
        }

        if (this.state === 'IDLE' || this.state === 'ENEMY_ATTACK') {
            this.lastUltimateTime = now;
            // Visuals FIRST
            this.ui.triggerUltimateVisuals();
            this.ui.spawnShockwave(window.innerWidth / 2, window.innerHeight / 2);
            this.ui.triggerScreenShake();

            // Massive Damage
            this.enemyHP -= 30;
            this.ui.showDamageText("-30", window.innerWidth / 2, window.innerHeight / 2, "gold");
            this.ui.updateHealth(this.playerHP, this.enemyHP, this.enemyMaxHP);
            this.ui.playSlapSound(2.0); // High pitch!

            // Hurt Visual
            this.ui.setBossImage(this.assets.hurt);
            setTimeout(() => {
                if (this.state === 'IDLE')
                    this.ui.setBossImage(this.assets.normal);
            }, 1000); // 1s stun visual

            // Spawn tons of particles
            this.ui.spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 'gold');

            if (this.enemyHP <= 0) {
                this.onWin();
            } else {
                // Stun boss?
                this.state = 'IDLE';
                // Reset next attack to give breathing room
                this.nextAttackTime = Date.now() + 3000;
            }
        }
    }

    onHurricane() {
        if (this.state === 'IDLE' || this.state === 'ENEMY_ATTACK') {
            this.ui.showFeedback("HURRICANE!", "cyan");
            this.ui.triggerScreenShake();
            this.ui.spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 'cyan');
            this.ui.spawnTyphoon(); // Visual Effect

            // Deal Damage
            this.enemyHP -= 15;
            this.ui.showDamageText("-15", window.innerWidth / 2, window.innerHeight / 2 - 50, "cyan");
            this.ui.updateHealth(this.playerHP, this.enemyHP, this.enemyMaxHP);
            this.ui.playSlapSound(1.5);

            this.ui.setBossImage(this.assets.hurt);
            setTimeout(() => {
                if (this.state === 'IDLE')
                    this.ui.setBossImage(this.assets.normal);
            }, 800);

            if (this.enemyHP <= 0) {
                this.onWin();
            }
        }
    }

    onWin() {
        this.state = 'VICTORY';
        // this.ui.showFeedback("BOSS DEFEATED!", "gold"); // Optional, maybe redundant with big screen
        this.ui.setBossImage(this.assets.lose);
        console.log("Game Won!");

        // Show Victory Screen after a short delay to see the unmasked face

        setTimeout(() => {
            this.ui.showVictoryScreen();
        }, 2000);
    }

    onDefeat() {
        console.log("BattleSystem: onDefeat TRIGGERED! HP:", this.playerHP);
        this.state = 'DEFEAT';
        this.ui.showFeedback("YOU DIED!", "black");
        this.ui.setBossImage(this.assets.win);
        console.log("Game Lost!");
        setTimeout(() => {
            this.ui.showDefeatScreen();
        }, 1000);
    }

    // New Block Logic
    setBlocking(active) {
        if (active) {
            if (!this.isBlocking) {
                this.isBlocking = true;
                this.blockStartTime = Date.now();
            }
        } else {
            this.isBlocking = false;
        }
    }

    resolveEnemyAttack() {
        if (this.state !== 'ENEMY_ATTACK') return;

        let blocked = false;
        if (this.isBlocking) {
            const blockDuration = Date.now() - this.blockStartTime;
            if (blockDuration < 2000) { // 2 Seconds max hold
                blocked = true;
            } else {
                this.ui.showFeedback("GUARD BROKEN! (Too Long)", "orange");
            }
        }

        if (blocked) {
            this.ui.showFeedback("BLOCKED!", "blue");
            this.ui.spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 'cyan'); // Blue sparks
            this.state = 'IDLE';
        } else {
            // Take Damage
            this.playerHP -= 10;
            this.ui.showDamageText("-10", window.innerWidth / 4, window.innerHeight / 2, "red");
            this.ui.updateHealth(this.playerHP, this.enemyHP, this.enemyMaxHP);

            if (this.playerHP <= 0) {
                console.log("BattleSystem: Player Died in resolveEnemyAttack. HP:", this.playerHP);
                this.onDefeat();
            } else {
                this.state = 'IDLE';
                // Revert to Normal State
                this.ui.setBossImage(this.assets.normal);
            }
        }
    }
}
