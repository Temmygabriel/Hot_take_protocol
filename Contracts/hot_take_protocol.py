# v1.1
# { "Depends": "py-genlayer:test" }

import genlayer.gl as gl
from genlayer import TreeMap, u256
import json


SCENARIOS = [
    {"id": 0, "cat": "tech", "title": "AI Will Replace Programmers", "prompt": "AI will fully replace software developers within 10 years and that is a good thing for humanity."},
    {"id": 1, "cat": "tech", "title": "Social Media Rewired Us", "prompt": "Social media has permanently damaged human attention spans and society would be healthier if it disappeared tomorrow."},
    {"id": 2, "cat": "tech", "title": "Crypto Is Useless", "prompt": "Cryptocurrency has created zero real-world value and exists purely as a wealth transfer mechanism from the naive to the early."},
    {"id": 3, "cat": "tech", "title": "Remote Work Is a Lie", "prompt": "Remote work killed company culture and most people are secretly less productive at home than they admit."},
    {"id": 4, "cat": "tech", "title": "Smartphones Made Us Weaker", "prompt": "Smartphones have made an entire generation psychologically fragile and incapable of boredom, which was the source of all great ideas."},
    {"id": 5, "cat": "tech", "title": "Open Source Is Exploitation", "prompt": "Open source software is a system that lets billion-dollar companies exploit free labour from passionate developers who get nothing back."},
    {"id": 6, "cat": "tech", "title": "Electric Cars Are Greenwashing", "prompt": "Electric vehicles are a feel-good solution that ignores the environmental cost of batteries and just moves pollution elsewhere."},
    {"id": 7, "cat": "tech", "title": "The Metaverse Was a Scam", "prompt": "Meta spent 40 billion dollars proving that nobody actually wants to attend meetings as a cartoon avatar."},
    {"id": 8, "cat": "culture", "title": "Streaming Killed Cinema", "prompt": "Streaming services have permanently destroyed the theatrical experience and the era of truly great films is over."},
    {"id": 9, "cat": "culture", "title": "Reboots Are Lazy", "prompt": "Hollywoods obsession with reboots and sequels is not just lazy - it actively prevents the next generation of iconic stories from existing."},
    {"id": 10, "cat": "culture", "title": "Music Is Getting Worse", "prompt": "Pop music peaked in the 1990s and everything since has been a gradual decline in musical complexity and emotional depth."},
    {"id": 11, "cat": "culture", "title": "Influencers Are Not Real Jobs", "prompt": "Being a social media influencer is not a legitimate career and people who list it as their profession are not working."},
    {"id": 12, "cat": "culture", "title": "Award Shows Are Rigged", "prompt": "Major music and film award shows stopped reflecting actual quality decades ago and now exist purely to manufacture cultural conversation."},
    {"id": 13, "cat": "culture", "title": "Nostalgia Is Destroying Culture", "prompt": "Societys obsession with nostalgia stops us from creating genuinely new things because we are too busy repackaging the past."},
    {"id": 14, "cat": "culture", "title": "True Crime Is Exploitation", "prompt": "The true crime genre is ethically indefensible entertainment that profits from victims suffering while audiences pretend they are learning something."},
    {"id": 15, "cat": "culture", "title": "Stand-Up Comedy Went Soft", "prompt": "Modern stand-up comedy has been so neutered by audience sensitivity that it can no longer perform its actual function of telling uncomfortable truths."},
    {"id": 16, "cat": "food", "title": "Veganism Is a Privilege", "prompt": "Veganism is an ethical stance that only wealthy people in wealthy countries can afford to take and its proponents ignore this constantly."},
    {"id": 17, "cat": "food", "title": "Meal Prep Culture Is Sad", "prompt": "People who spend their Sundays batch-cooking identical containers of food have optimised all the joy out of eating."},
    {"id": 18, "cat": "food", "title": "Coffee Culture Is a Cult", "prompt": "Specialty coffee culture is just a socially acceptable way for adults to have an extremely expensive addiction they feel smart about."},
    {"id": 19, "cat": "food", "title": "Wellness Industry Is a Scam", "prompt": "The wellness industry is the most profitable scam in history, selling solutions to problems it manufactured and anxiety it sustains."},
    {"id": 20, "cat": "food", "title": "Fine Dining Is Theatre", "prompt": "Expensive fine dining restaurants are selling an experience of feeling sophisticated rather than food that actually tastes better than a good street stall."},
    {"id": 21, "cat": "food", "title": "Food Delivery Ruined Cities", "prompt": "Food delivery apps destroyed local restaurant culture by creating a race to the bottom on price while the apps take most of the money."},
    {"id": 22, "cat": "food", "title": "Diets Never Work", "prompt": "The entire dieting industry is built on the fact that diets fail - if they worked there would be no industry."},
    {"id": 23, "cat": "sports", "title": "Money Ruined Football", "prompt": "The influx of billionaire money into football has made the sport less competitive, less authentic and ultimately less watchable."},
    {"id": 24, "cat": "sports", "title": "E-Sports Are Real Sports", "prompt": "Competitive gaming requires more skill, faster reaction times, and more strategic depth than most sports that get Olympic status."},
    {"id": 25, "cat": "sports", "title": "Athlete Worship Is Dangerous", "prompt": "Societys treatment of professional athletes as role models is dangerous because we are confusing physical talent with moral authority."},
    {"id": 26, "cat": "sports", "title": "VAR Ruined Football", "prompt": "Video Assistant Referee technology sucked all emotion from football and replaced genuine human drama with bureaucratic pedantry."},
    {"id": 27, "cat": "sports", "title": "The Olympics Are Outdated", "prompt": "The modern Olympics is a corrupt, financially disastrous event that benefits no one except IOC officials and construction companies."},
    {"id": 28, "cat": "sports", "title": "Doping Should Be Legal", "prompt": "Performance-enhancing drugs should be fully legalised in professional sports - it would be more honest and the competition more spectacular."},
    {"id": 29, "cat": "sports", "title": "Fantasy Sports Are Gambling", "prompt": "Fantasy sports leagues are just gambling rebranded for people who think they are too smart to bet on horses."},
    {"id": 30, "cat": "money", "title": "Hustle Culture Is Self-Harm", "prompt": "Hustle culture is a form of collective self-harm that benefits employers while destroying workers health, relationships, and identity."},
    {"id": 31, "cat": "money", "title": "University Is a Scam", "prompt": "For most people, university is an overpriced credentialing system that produces debt not skills and should be replaced entirely."},
    {"id": 32, "cat": "money", "title": "Billionaires Should Not Exist", "prompt": "No one earns a billion dollars - they extract it. A billionaire is proof that a system is broken not that a person is exceptional."},
    {"id": 33, "cat": "money", "title": "Four-Day Week Should Be Law", "prompt": "The five-day work week is an arbitrary industrial relic and any company that cannot survive on four days has an efficiency problem not a time problem."},
    {"id": 34, "cat": "money", "title": "Passion Work Is a Trap", "prompt": "Turning your passion into your job is terrible advice that destroys hobbies and creates miserable workers who cannot quit without identity collapse."},
    {"id": 35, "cat": "money", "title": "Tipping Culture Is Broken", "prompt": "Tipping culture is a mechanism that lets employers pay poverty wages while making customers feel responsible for their workers survival."},
    {"id": 36, "cat": "money", "title": "Startups Are Mostly Luck", "prompt": "Successful startup founders are mostly lucky people with good timing who later confuse their luck for genius and sell that delusion to others."},
    {"id": 37, "cat": "society", "title": "Marriage Is Outdated", "prompt": "Marriage is a legal and religious contract designed for a world that no longer exists and most people only do it for the party and the photos."},
    {"id": 38, "cat": "society", "title": "Cancel Culture Works", "prompt": "Cancel culture is just accountability by another name - people are only upset about it when people they like are the ones being held responsible."},
    {"id": 39, "cat": "society", "title": "Therapy Is Overrated", "prompt": "Therapy has become a consumer product that medicalises normal human struggle and makes people better at talking about their problems than solving them."},
    {"id": 40, "cat": "society", "title": "Parenting Styles Do Not Matter", "prompt": "Most parenting style debates are middle-class anxiety performance - genetics and peer groups matter far more than whether you did attachment parenting."},
    {"id": 41, "cat": "society", "title": "Online Dating Killed Romance", "prompt": "Dating apps turned human connection into a shopping experience and trained a generation to see people as options rather than individuals."},
    {"id": 42, "cat": "society", "title": "Adulthood Starts Later Now", "prompt": "Modern 30-year-olds are functionally equivalent to what 20-year-olds used to be and society keeps pretending this is not happening."},
    {"id": 43, "cat": "society", "title": "Horoscopes Are Harmless Lies", "prompt": "Astrology is harmless entertainment right up until someone uses it to make an actual decision about their career, relationship, or who to trust."},
    {"id": 44, "cat": "wild", "title": "Pineapple Belongs on Pizza", "prompt": "Pineapple on pizza is objectively correct and people who oppose it are performing a personality rather than expressing a genuine taste preference."},
    {"id": 45, "cat": "wild", "title": "Mornings Are Overrated", "prompt": "Morning people built a society optimised for morning people and then invented productivity to make everyone else feel guilty about it."},
    {"id": 46, "cat": "wild", "title": "Pets Are Replacements", "prompt": "The rise of pet culture in wealthy countries is a direct symptom of loneliness, declining birth rates, and people outsourcing emotional intimacy to animals."},
    {"id": 47, "cat": "wild", "title": "Queues Are Social Control", "prompt": "The willingness to queue politely for anything is a form of learned helplessness that societies mistake for civic virtue."},
    {"id": 48, "cat": "wild", "title": "Silence Is the New Luxury", "prompt": "In 20 years the ultimate status symbol will not be a car or a watch but the ability to sit in a room with no notifications, no noise, and no obligations."},
    {"id": 49, "cat": "wild", "title": "Adulting Was Always Hard", "prompt": "Every generation thinks the generation after them has it easy and every generation is wrong - difficulty just changes shape, it does not shrink."},
]

BOTS = {
    "bot_barstool": {
        "name": "BarStoolPhil",
        "stance_weights": [6, 1, 3],
        "takes": {
            "tech":    ["Bro this is not even a debate. {topic} is just facts and only people who never leave the house disagree.", "I said what I said about {topic} and I will die on this hill. Zero apologies.", "Everyone pretending {topic} is complicated needs to touch grass. It is simple."],
            "culture": ["I have been saying {topic} for years and nobody listened. Now look.", "Phil was RIGHT about {topic}. Put some respect on my takes.", "The discourse around {topic} is embarrassing. Let me break it down for you."],
            "food":    ["Listen. {topic} is just the truth. I grew up on real food and I know the difference.", "People acting shocked about {topic} have never been hungry a day in their life.", "Hot take that should be cold take: {topic}. Thank you for coming to my talk."],
            "sports":  ["As someone who has watched every game for 15 years, {topic} is the most obvious thing I have ever typed.", "{topic} and if your team is doing well you know exactly why. The numbers do not lie.", "Casual fans will fight you on {topic} but real ones know."],
            "money":   ["{topic} and any real entrepreneur will tell you the same behind closed doors.", "Spent 12 years in the industry. {topic}. That is not a take, that is a debrief.", "Stop being polite about {topic}. Polite does not pay bills."],
            "society": ["Phil has logged the hours on this. {topic} is just what happens when you pay attention.", "People act offended by {topic} because it is too close to home.", "Not here to make friends. Here to be right. {topic}."],
            "wild":    ["{topic} and I will not be elaborating further.", "The fact that people argue about {topic} tells you everything about the state of public debate.", "Phils Law: {topic}. Tattoo it."],
        }
    },
    "bot_tara": {
        "name": "ThinkPieceTara",
        "stance_weights": [1, 6, 3],
        "takes": {
            "tech":    ["Actually, if you look at the longitudinal data on {topic}, the consensus is far more nuanced than this framing suggests.", "The discourse around {topic} reveals more about our collective anxieties than about the subject itself, frankly.", "I wrote 3000 words on {topic} last year and the argument here misses the structural dimension entirely."],
            "culture": ["{topic} is a symptom not a cause and until we address the underlying systems nothing changes.", "The framing of {topic} as a binary misses how deeply the incentive structures are misaligned.", "Interesting that we keep having {topic} debates without ever asking who benefits from the current arrangement."],
            "food":    ["The epidemiological evidence on {topic} is being used to justify the kind of individual-blame narrative that protects industry.", "{topic} discourse almost always ignores class, geography, and access in ways that are frankly intellectually embarrassing.", "Three peer-reviewed papers later, my position on {topic} is: it is complicated and anyone telling you otherwise is selling something."],
            "sports":  ["The sociology of {topic} has been studied extensively and the popular take is almost exactly backwards.", "{topic} sits at the intersection of labour rights, spectacle economy, and identity formation. You cannot reduce it to a hot take.", "My issue with the {topic} conversation is that it collapses a very complex power dynamic into something that feels satisfying to tweet."],
            "money":   ["The economic literature on {topic} is unambiguous but it challenges too many comfortable assumptions so it gets ignored.", "{topic} is a policy question being treated as a culture war and that sleight of hand is doing a lot of work for a lot of people.", "I find it fascinating that {topic} surprises people when the incentive structure has been pointing here for thirty years."],
            "society": ["The pathologisation of {topic} is itself a product of the conditions we should be interrogating.", "{topic} cannot be disentangled from broader patterns of late-capitalist atomisation. I said what I said.", "We do not have a {topic} problem. We have a structural conditions problem that manifests as a {topic} conversation."],
            "wild":    ["I understand why people find {topic} amusing but the underlying dynamic is worth taking seriously.", "The reason {topic} generates heat is that it is a proxy for something people cannot say directly.", "Treating {topic} as trivial is itself a kind of politics."],
        }
    },
    "bot_val": {
        "name": "VibeCheckVal",
        "stance_weights": [4, 3, 3],
        "takes": {
            "tech":    ["ok but hear me out about {topic}... actually no wait I changed my mind halfway through typing that", "the {topic} conversation is giving main character energy and I cannot decide if that is genius or a cry for help", "me at {topic}: bestie we need to talk"],
            "culture": ["the way {topic} lives rent free in my head at 2am is genuinely concerning for my wellbeing", "{topic} said choose violence and honestly? respect.", "cannot believe we live in a world where {topic} is a real sentence people say with their whole chest"],
            "food":    ["my therapist said I need to stop having opinions about {topic} but here we are again", "{topic} understood the assignment and also the assignment was chaos", "the {topic} girlies and guys are eating (literally or figuratively, depending)"],
            "sports":  ["as someone with zero expertise and maximum feelings, {topic} is sending me", "the {topic} discourse is so loud that I spiritually left my body and I agree with everyone now", "hot girl summer but make it {topic} discourse szn"],
            "money":   ["{topic} is the plot twist in the movie of capitalism and I do not like this film", "me trying to have a normal opinion about {topic} and failing spectacularly", "the {topic} agenda is being pushed and I for one welcome our new whatever this is"],
            "society": ["unpopular opinion but {topic} slaps and you cannot make me feel bad about that", "{topic} really said the quiet part loud and now we all have to live here", "the {topic} pipeline is real and I have the search history to prove it"],
            "wild":    ["okay {topic} is actually sending me to another dimension I cannot", "the {topic} lore goes so deep and I am only now realising I have been living inside it", "if {topic} is wrong I do not want to be right and that is my final answer until I change it"],
        }
    },
    "bot_kev": {
        "name": "ContrarianKev",
        "stance_weights": [2, 2, 6],
        "takes": {
            "tech":    ["Hot take: everyone is wrong about {topic}. The real story is the opposite of what you think and nobody wants to hear it.", "Contrarian position incoming: {topic} is being used to distract from the thing that actually matters here.", "I know this is unpopular but {topic} is exactly backwards and the people most confident about it are the most wrong."],
            "culture": ["Bold claim: {topic} is the symptom, not the disease, and we are treating it exactly backwards.", "The actual hot take about {topic} that nobody will say: we created the conditions and then acted surprised.", "Everyone is performing outrage about {topic} but nobody is asking the question that would actually explain it."],
            "food":    ["Contrarian take: everything you believe about {topic} was manufactured by an industry and then laundered through journalism.", "The {topic} consensus is a moral panic dressed as science and the evidence base is thinner than anyone admits.", "Real talk: {topic} is the thing people fight about so they do not have to fight about what actually matters."],
            "sports":  ["Nobody wants to hear it but {topic} is just rich men fighting over which rich men get richer. Everything else is narrative.", "The fact that people are passionate about {topic} is more interesting than {topic} itself. Study the passion.", "Controversial take: {topic} only exists as a debate because it generates engagement. There is no right answer by design."],
            "money":   ["Everyone is mad about {topic} in the wrong direction. The actual problem is three levels up from where the conversation is happening.", "The {topic} debate always reaches a consensus that conveniently never challenges anyone with actual power. Funny how that works.", "Kevs law: if the mainstream has a strong take on {topic}, the truth is at least 90 degrees from that."],
            "society": ["The {topic} conversation exists to make you feel like you are thinking critically while actually reinforcing the status quo.", "Every generation discovers {topic} and thinks it is new. Read a history book. The conditions are identical.", "My genuinely unpopular opinion: {topic} is real but everyone arguing about it is arguing about the wrong level of the problem."],
            "wild":    ["The {topic} debate is a distraction from the fact that we have collectively agreed not to notice the obvious thing.", "Hot take about {topic}: the people most certain about this are certain in opposite directions and they are all correct in the ways that do not matter.", "Contrarian corner: {topic} is a Rorschach test. What you see says more about you than about {topic}."],
        }
    },
    "bot_craig": {
        "name": "CorporateCraig",
        "stance_weights": [5, 3, 2],
        "takes": {
            "tech":    ["From a ROI perspective, {topic} represents a paradigm shift that early adopters will leverage into asymmetric competitive advantage.", "Let us take {topic} offline and circle back with a deck that properly captures the value proposition here.", "The {topic} space is crowded but the companies that align their core competencies with this reality will own the next decade."],
            "culture": ["I have seen {topic} come up in three all-hands this quarter. Leadership is paying attention. The smart move is positioning early.", "{topic} is not a culture issue, it is a talent pipeline issue. Companies that treat it as the latter will win.", "Honestly? {topic} is table stakes now. The differentiator is execution. And execution requires buy-in at every level."],
            "food":    ["The {topic} market is a 40 billion dollar opportunity that most operators are leaving on the table because they cannot get out of their own way.", "From a consumer behaviour standpoint, {topic} signals a fundamental shift in purchase intent that brands need to respect.", "The {topic} conversation is happening in boardrooms right now. The question is whether you are in the room or the agenda item."],
            "sports":  ["The {topic} situation is a stakeholder alignment problem first and a sports problem second. Follow the incentives.", "Any serious sports business conversation about {topic} has to start with the media rights structure. Everything else is commentary.", "{topic} is a brand equity question as much as anything else. The franchises that manage the narrative will retain value."],
            "money":   ["{topic} is the single most important variable in any workforce planning conversation happening right now. Full stop.", "I have run the numbers on {topic} three different ways and the answer is always the same: adapt early or pay a premium to catch up.", "The {topic} resistance inside organisations is always a middle management problem. Fix that layer and everything else follows."],
            "society": ["The {topic} discourse is missing the institutional incentive layer. Once you see it, you cannot unsee it.", "Any policy framework for {topic} that does not account for implementation costs is a PowerPoint, not a plan.", "{topic} requires cross-functional alignment and frankly most organisations do not have the operating model to execute on it."],
            "wild":    ["The {topic} conversation is underrated as a leading indicator of broader market sentiment. I track it quarterly.", "Framing {topic} as trivial is a cognitive bias that cost the Blockbusters of the world their future. Just saying.", "If {topic} is not on your strategic roadmap for next year, you are already behind the curve."],
        }
    },
    "bot_diana": {
        "name": "DeepCutDiana",
        "stance_weights": [3, 2, 5],
        "takes": {
            "tech":    ["{topic} is basically just the Gutenberg panic of our era. Every generation gets one. Ours got this.", "The {topic} discourse is structurally identical to the 1890s debate about whether bicycles would destroy courtship. We survived.", "Umberto Eco wrote about {topic} in 1994 and nobody read it and here we all are, surprised."],
            "culture": ["The {topic} phenomenon is just the 1950s culture panic with better graphics and worse attention spans.", "I keep seeing {topic} discussed as though Guy Debord did not literally write the manual on this in 1967.", "{topic} is La Jetee. I know that sounds wrong. Sit with it."],
            "food":    ["The {topic} anxiety maps perfectly onto every food moral panic since the Victorian era. The targets change. The structure is identical.", "There is a 1973 Journal of Nutritional Science paper that explains {topic} more clearly than anything written since. Nobody cites it.", "{topic} is just class anxiety that found a new food to put itself inside. It has always been about class."],
            "sports":  ["The {topic} debate is just the Roman bread and circuses argument updated for broadcast rights. Juvenal was right. He was just early.", "Everything being said about {topic} was said about professional boxing in 1910. We have a very short cultural memory.", "{topic} sits inside a much older argument about amateurism versus professionalism that the Olympics tried to resolve and failed."],
            "money":   ["The {topic} conversation is structurally the same as every guild versus market debate since the 14th century. New vocabulary. Same fight.", "Karl Polanyi described the exact {topic} dynamic in 1944. The Great Transformation. Chapter four. You are welcome.", "{topic} is just enclosure with a better user interface."],
            "society": ["The {topic} panic is the 19th century urban degeneration thesis repackaged for people who have not read the 19th century urban degeneration thesis.", "There is a direct line from the {topic} debate to the 1920s neurasthenia epidemic. The diagnosis changes. The anxiety does not.", "{topic} would make complete sense to anyone who studied the demographic transition theory. Most people did not."],
            "wild":    ["{topic} is structurally a Chestertons Fence problem and the people tearing it down have not asked why it was built.", "The {topic} discourse is what happens when you run a cargo cult logic engine on a social phenomenon. Correlation. No causation. Maximum confidence.", "Jorge Luis Borges wrote a short story that is essentially about {topic}. It was not meant as a blueprint."],
        }
    },
    "bot_max": {
        "name": "MainCharacterMax",
        "stance_weights": [6, 1, 3],
        "takes": {
            "tech":    ["I have actually lived this. {topic} changed the trajectory of my entire professional life and I am a primary source.", "Not to make {topic} about me, but this is literally my origin story so I am making it about me.", "People theorise about {topic} but I have been in the rooms. I have the receipts. I have the calluses."],
            "culture": ["The reason I have such strong feelings about {topic} is that it directly shaped who I became as a person. This is personal.", "I wrote about {topic} in my journal when I was 19 and my 19-year-old self was right. That is growth.", "{topic} hit different when it happens to you specifically. Trust me on this. I am a case study."],
            "food":    ["My entire relationship with food changed because of {topic}. I cried. I am not embarrassed about that.", "I have tried everything on {topic} and I am giving you the distilled wisdom of several expensive mistakes.", "{topic} is something I navigated publicly and if you want the unfiltered version, I am still processing but here we go."],
            "sports":  ["I trained for seven months for an event that made me understand {topic} on a cellular level. Hear me out.", "The {topic} conversation changes completely once you have been inside it rather than observing from outside.", "My coach told me something about {topic} that I think about every single day. It is this take. Basically."],
            "money":   ["I lost significant money because I did not understand {topic} early enough. Now I understand it too well. Let me save you the tuition.", "{topic} was the most expensive lesson of my professional life and I turned it into a perspective that I will now share freely.", "Failed forward on {topic}. Still here. Wiser. Slightly broken. Here is what I learned."],
            "society": ["My experience with {topic} was so formative that I genuinely cannot be objective about it. But subjectively? Here is the full force of my feelings.", "I wrote a thread about {topic} that got 40000 impressions and the ratio was instructive. I stand by every word.", "The {topic} discourse needed a personal testimony and I volunteered. Here is mine. It is real."],
            "wild":    ["Not to centre myself but {topic} is something I have a parasocial relationship with and it has been a journey.", "My therapist and I have discussed {topic} specifically and she said something that reframed everything. I am paraphrasing but: this take.", "{topic} shaped me. There. I said it. Accountability arc complete."],
        }
    },
    "bot_nate": {
        "name": "NullPointerNate",
        "stance_weights": [3, 3, 4],
        "takes": {
            "tech":    ["Okay so {topic} is clearly wrong but also wait... actually... no I had it. Hmm. The answer is yes. Or the opposite of yes.", "I started this take on {topic} confident and I am ending it less confident. That is growth. I think.", "My take on {topic}: strong agree, unless you consider the counterargument, which I just did, so now I am less sure. Still submitting."],
            "culture": ["The {topic} situation is bad, unless it is good, which it might be if you squint, which I am doing, and now I see both sides equally.", "I had a whole thing on {topic} and then I argued against myself and now I have two equally good takes that contradict each other. Here is one of them.", "Hot take on {topic}: definitely. Wait, is it though? Yes. No. The answer is yes with significant caveats that undermine the yes."],
            "food":    ["My position on {topic} is nuanced in the sense that I have changed it four times in the last two minutes and this is take number three.", "{topic} is something I feel strongly about in a direction that is unclear even to me. Here is my confident uncertainty.", "Started this take agreeing with {topic}, wrote half of it, got worried, finished it disagreeing, read it back, now I am neutral but animated."],
            "sports":  ["The {topic} argument is compelling and so is the counterargument and I cannot hold both at once so I am emitting energy in the direction of whichever one feels true right now.", "I watched three debates about {topic} and came out understanding it less than when I started. This take is the debris.", "My sports hot take on {topic}: passionate, directional, partially self-contradictory, submitted with full commitment to positions I may abandon."],
            "money":   ["{topic} is the thing where the more you read about it the less sure you become and I have read about it extensively. So.", "I calculated my position on {topic} using vibes and I came out confident about a conclusion that dissolves when examined. Here it is anyway.", "Economic take on {topic}: real, partially wrong in ways I cannot identify, presented with unearned certainty. You are welcome."],
            "society": ["My social theory on {topic} is that something is happening and it matters and the thing that is happening is... I had it... it is this.", "I wrote a serious take on {topic} and then a joke take and accidentally made the joke take more coherent. I am submitting the serious one anyway.", "{topic} is definitely a real thing with real implications that I am gesturing towards with both hands while making significant eye contact."],
            "wild":    ["Okay {topic} is... wait. Is it though? Yes. But also. Okay I have a take. The take is: yes, mostly, with exceptions that include most cases.", "I am extremely confident about {topic} in a way that should concern both of us. Here is the confidence. It is strong. It may be wrong.", "Final answer on {topic}: this. This is my answer. This is a sentence that I am completing with my take which is: yes, {topic} is the thing, definitely."],
        }
    },
}

BOT_IDS = ("bot_barstool", "bot_tara", "bot_val", "bot_kev", "bot_craig", "bot_diana", "bot_max", "bot_nate")


class HotTakeProtocol(gl.Contract):

    game_count: u256
    room_count: u256
    recent_count: u256
    rooms: TreeMap[str, str]
    player_stats: TreeMap[str, str]
    recent_game_ids: TreeMap[u256, str]

    def __init__(self):
        self.game_count = u256(0)
        self.room_count = u256(0)
        self.recent_count = u256(0)

    def _read_room(self, room_code):
        return json.loads(self.rooms[room_code])

    def _write_room(self, room_code, room_data):
        self.rooms[room_code] = json.dumps(room_data)

    def _read_stats(self, address):
        stats_json = self.player_stats.get(address)
        if stats_json is None:
            return {"games_played": 0, "total_score": 0, "wins": 0, "best_take": "", "display_name": ""}
        return json.loads(stats_json)

    def _write_stats(self, address, stats):
        self.player_stats[address] = json.dumps(stats)

    def _pick_scenarios(self, seed):
        total = len(SCENARIOS)
        i1 = seed % total
        i2 = (seed * 7 + 13) % total
        i3 = (seed * 13 + 29) % total
        if i2 == i1:
            i2 = (i2 + 1) % total
        if i3 == i1 or i3 == i2:
            i3 = (i3 + 1) % total
        if i3 == i1:
            i3 = (i3 + 1) % total
        return [SCENARIOS[i1], SCENARIOS[i2], SCENARIOS[i3]]

    def _pick_bots(self, seed):
        shuffled = list(BOT_IDS)
        for i in range(len(shuffled) - 1, 0, -1):
            j = (seed * 1009 + i * 97) % (i + 1)
            shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
        return shuffled[:4]

    def _pick_stance(self, bot_id, seed):
        weights = BOTS[bot_id]["stance_weights"]
        roll = seed % 10
        if roll < weights[0]:
            return "genius"
        elif roll < weights[0] + weights[1]:
            return "trash"
        else:
            return "spicy"

    def _pick_take(self, bot_id, cat, topic, seed):
        takes = BOTS[bot_id]["takes"].get(cat, BOTS[bot_id]["takes"]["wild"])
        return takes[seed % len(takes)].replace("{topic}", topic)

    def _make_room_code(self):
        self.room_count = u256(int(self.room_count) + 1)
        n = int(self.game_count) * 1009 + int(self.room_count) * 97 + 42
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        code = ""
        for _ in range(6):
            code = code + chars[n % len(chars)]
            n = n // len(chars)
        return code

    @gl.public.write
    def create_room(self, host_address: str, host_name: str) -> str:
        self.game_count = u256(int(self.game_count) + 1)
        code = self._make_room_code()
        seed = int(self.game_count) * 1009 + int(self.room_count) * 97
        scenarios = self._pick_scenarios(seed)
        room_data = {
            "code": code,
            "host": host_address,
            "status": "lobby",
            "is_solo": False,
            "players": {
                host_address: {
                    "name": host_name,
                    "address": host_address,
                    "ready": False,
                    "score": 0,
                    "ai_score": 0,
                    "vote_score": 0,
                    "is_bot": False
                }
            },
            "scenarios": scenarios,
            "submissions": {},
            "votes": {},
            "results": {},
            "rankings": [],
            "game_id": int(self.game_count)
        }
        self._write_room(code, room_data)
        stats = self._read_stats(host_address)
        stats["display_name"] = host_name
        self._write_stats(host_address, stats)
        return code

    @gl.public.write
    def create_solo_room(self, player_address: str, player_name: str) -> str:
        self.game_count = u256(int(self.game_count) + 1)
        code = self._make_room_code()
        seed = int(self.game_count) * 1009 + int(self.room_count) * 97

        scenarios = self._pick_scenarios(seed)
        bot_ids = self._pick_bots(seed)

        players = {
            player_address: {
                "name": player_name,
                "address": player_address,
                "ready": True,
                "score": 0,
                "ai_score": 0,
                "vote_score": 0,
                "is_bot": False
            }
        }
        for bot_id in bot_ids:
            players[bot_id] = {
                "name": BOTS[bot_id]["name"],
                "address": bot_id,
                "ready": True,
                "score": 0,
                "ai_score": 0,
                "vote_score": 0,
                "is_bot": True
            }

        submissions = {}
        for i, bot_id in enumerate(bot_ids):
            bot_seed = seed + i * 37 + 11
            scenario = scenarios[bot_seed % len(scenarios)]
            stance = self._pick_stance(bot_id, bot_seed + 7)
            take = self._pick_take(bot_id, scenario["cat"], scenario["title"], bot_seed + 13)
            submissions[bot_id] = {
                "player": bot_id,
                "name": BOTS[bot_id]["name"],
                "scenario_id": scenario["id"],
                "scenario_title": scenario["title"],
                "scenario_cat": scenario["cat"],
                "stance": stance,
                "take": take,
                "is_bot": True
            }

        room_data = {
            "code": code,
            "host": player_address,
            "status": "round_1",
            "is_solo": True,
            "players": players,
            "scenarios": scenarios,
            "submissions": submissions,
            "votes": {},
            "results": {},
            "rankings": [],
            "game_id": int(self.game_count),
            "bots_ready": True
        }
        self._write_room(code, room_data)
        stats = self._read_stats(player_address)
        stats["display_name"] = player_name
        self._write_stats(player_address, stats)
        return code

    @gl.public.write
    def join_room(self, room_code: str, player_address: str, player_name: str) -> None:
        room_data = self._read_room(room_code)
        if room_data["status"] != "lobby":
            return
        if player_address in room_data["players"]:
            return
        if len(room_data["players"]) >= 5:
            return
        room_data["players"][player_address] = {
            "name": player_name,
            "address": player_address,
            "ready": False,
            "score": 0,
            "ai_score": 0,
            "vote_score": 0,
            "is_bot": False
        }
        self._write_room(room_code, room_data)
        stats = self._read_stats(player_address)
        stats["display_name"] = player_name
        self._write_stats(player_address, stats)

    @gl.public.write
    def toggle_ready(self, room_code: str, player_address: str) -> None:
        room_data = self._read_room(room_code)
        if room_data["status"] != "lobby":
            return
        if player_address not in room_data["players"]:
            return
        room_data["players"][player_address]["ready"] = not room_data["players"][player_address]["ready"]
        self._write_room(room_code, room_data)

    @gl.public.write
    def start_game(self, room_code: str, host_address: str) -> None:
        room_data = self._read_room(room_code)
        if room_data["host"] != host_address:
            return
        if room_data["status"] != "lobby":
            return
        room_data["status"] = "round_1"
        self._write_room(room_code, room_data)

    @gl.public.write
    def submit_take(self, room_code: str, player_address: str, scenario_id: int, stance: str, take_text: str) -> None:
        room_data = self._read_room(room_code)
        if room_data["status"] != "round_1":
            return
        if player_address not in room_data["players"]:
            return
        scenario = None
        for s in room_data["scenarios"]:
            if s["id"] == scenario_id:
                scenario = s
                break
        if scenario is None:
            return
        room_data["submissions"][player_address] = {
            "player": player_address,
            "name": room_data["players"][player_address]["name"],
            "scenario_id": scenario_id,
            "scenario_title": scenario["title"],
            "scenario_cat": scenario["cat"],
            "stance": stance,
            "take": take_text,
            "is_bot": False
        }
        self._write_room(room_code, room_data)

    @gl.public.write
    def advance_to_voting(self, room_code: str) -> None:
        room_data = self._read_room(room_code)
        if room_data["status"] != "round_1":
            return
        room_data["status"] = "round_2"
        self._write_room(room_code, room_data)

    @gl.public.write
    def submit_votes(self, room_code: str, player_address: str, votes_data: str) -> None:
        room_data = self._read_room(room_code)
        if room_data["status"] != "round_2":
            return
        if player_address not in room_data["players"]:
            return
        votes = json.loads(votes_data)
        room_data["votes"][player_address] = votes
        if room_data["is_solo"]:
            for bot_id in list(room_data["players"].keys()):
                if bot_id == player_address:
                    continue
                if bot_id not in room_data["votes"]:
                    bot_seed = room_data["game_id"] * 37 + len(room_data["votes"]) * 13
                    score = (bot_seed % 3) + 1
                    room_data["votes"][bot_id] = {player_address: score}
        self._write_room(room_code, room_data)

    @gl.public.write
    def calculate_results(self, room_code: str) -> None:
        room_data = self._read_room(room_code)
        if room_data["status"] != "round_2":
            return

        submissions = room_data["submissions"]
        if len(submissions) == 0:
            room_data["status"] = "completed"
            self._write_room(room_code, room_data)
            return

        takes_lines = []
        for player_id, sub in submissions.items():
            takes_lines.append(
                "Player " + player_id +
                " | Scenario: " + sub["scenario_title"] +
                " | Stance: " + sub["stance"] +
                " | Take: " + sub["take"]
            )
        takes_text = "\n".join(takes_lines)

        prompt = (
            "You are judging hot takes in a party game. Score each player from 1-10.\n"
            "Criteria: persuasiveness, creativity, clarity.\n"
            "Stance (genius/trash/spicy) should match the energy of the take.\n\n"
            "Takes:\n" + takes_text + "\n\n"
            "Return ONLY a JSON object starting with { and ending with }. No markdown, no preamble.\n"
            'Format: {"rankings": [{"player": "player_id", "score": 8, "reason": "short sentence"}]}\n'
            "Order by score descending. Include all players above."
        )

        def generate():
            return gl.nondet.exec_prompt(prompt)

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="score hot takes in a party game",
            criteria="valid JSON object with rankings array, each entry has player, score, reason"
        )

        rankings = []
        try:
            start = result_raw.find("{")
            end = result_raw.rfind("}") + 1
            if start >= 0 and end > start:
                result_json = json.loads(result_raw[start:end])
                rankings = result_json.get("rankings", [])
        except Exception:
            rankings = []

        vote_scores = {}
        for voter_id, voter_votes in room_data["votes"].items():
            for voted_id, score in voter_votes.items():
                if voted_id not in vote_scores:
                    vote_scores[voted_id] = 0
                vote_scores[voted_id] = vote_scores[voted_id] + int(score)

        ai_scores = {}
        for rank_data in rankings:
            ranked_player = rank_data.get("player", "")
            score = rank_data.get("score", 5)
            reason = rank_data.get("reason", "")
            for player_id in submissions.keys():
                if (ranked_player == player_id or
                        player_id.startswith(ranked_player) or
                        ranked_player.startswith(player_id[:12])):
                    ai_scores[player_id] = {"score": score, "reason": reason}
                    break

        final_rankings = []
        for player_id in submissions.keys():
            ai_data = ai_scores.get(player_id, {"score": 5, "reason": "Solid take."})
            vote_s = vote_scores.get(player_id, 0)
            ai_s = ai_data["score"]
            total = ai_s + vote_s
            room_data["players"][player_id]["ai_score"] = ai_s
            room_data["players"][player_id]["vote_score"] = vote_s
            room_data["players"][player_id]["score"] = total
            final_rankings.append({
                "player": player_id,
                "name": submissions[player_id]["name"],
                "total_score": total,
                "ai_score": ai_s,
                "vote_score": vote_s,
                "reason": ai_data["reason"],
                "take": submissions[player_id]["take"],
                "scenario_title": submissions[player_id]["scenario_title"],
                "stance": submissions[player_id]["stance"]
            })

        final_rankings.sort(key=lambda x: x["total_score"], reverse=True)
        room_data["rankings"] = final_rankings
        room_data["status"] = "completed"
        self._write_room(room_code, room_data)

        for i, rank_entry in enumerate(final_rankings):
            pid = rank_entry["player"]
            if pid.startswith("bot_"):
                continue
            stats = self._read_stats(pid)
            stats["games_played"] = stats["games_played"] + 1
            stats["total_score"] = stats["total_score"] + rank_entry["total_score"]
            if i == 0:
                stats["wins"] = stats["wins"] + 1
            if len(rank_entry["take"]) > len(stats.get("best_take", "")):
                stats["best_take"] = rank_entry["take"]
            self._write_stats(pid, stats)

        idx = int(self.recent_count)
        self.recent_game_ids[u256(idx)] = room_code
        self.recent_count = u256(idx + 1)

    @gl.public.write
    def finalize_game(self, room_code: str) -> None:
        pass

    @gl.public.view
    def get_room(self, room_code: str) -> str:
        if room_code not in self.rooms:
            return json.dumps({"error": "Room not found"})
        return self.rooms[room_code]

    @gl.public.view
    def get_player_stats(self, player_address: str) -> str:
        stats_json = self.player_stats.get(player_address)
        if stats_json is None:
            return json.dumps({"games_played": 0, "total_score": 0, "wins": 0, "best_take": "", "display_name": ""})
        return stats_json

    @gl.public.view
    def get_global_leaderboard(self) -> str:
        entries = []
        for address in self.player_stats.keys():
            stats = json.loads(self.player_stats[address])
            if stats["games_played"] > 0:
                avg = stats["total_score"] / stats["games_played"]
                entries.append({
                    "address": address,
                    "name": stats.get("display_name", address[:8]),
                    "games_played": stats["games_played"],
                    "total_score": stats["total_score"],
                    "wins": stats["wins"],
                    "avg_score": round(avg, 1)
                })
        entries.sort(key=lambda x: x["total_score"], reverse=True)
        return json.dumps(entries[:20])

    @gl.public.view
    def get_recent_games(self, limit: int) -> str:
        recent = []
        total = int(self.recent_count)
        start = max(0, total - limit)
        for i in range(start, total):
            code = self.recent_game_ids.get(u256(i))
            if code is None:
                continue
            room_json = self.rooms.get(code)
            if room_json is None:
                continue
            room = json.loads(room_json)
            recent.append({
                "code": code,
                "game_id": room.get("game_id", 0),
                "player_count": len(room["players"]),
                "status": room["status"],
                "winner": room["rankings"][0]["name"] if room["rankings"] else ""
            })
        return json.dumps(recent)
