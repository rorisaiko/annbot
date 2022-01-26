# annbot
This is the bot on the ANN server.

Currently the only function of this bot is for you to register the video titles that you have, and to look for the people who has some specific titles.

This bot works in the dedicate bot channel as well as in the direct message channel between you and the bot.

## Usage

Here are the commands that you can use with the bot:

### `add`

Add one or more Title IDs into the database.

Syntax:
- If you want to add one title only, just type in the word `add`, a space, then the Title ID
	- For example: `add CBSKY-046`
- If you want to add more than one title, you can separate the title with a comma, a space, or both.
	- For example: `add CBSKY-046, SKIB-049` --OR-- `add CBSKY-046,SKIB-049` --OR-- `add CBSKY-046 SKIB-049`
- If you are copying the titles from a column in Excel, they may be spearated by lines. It's fine too.
	- For example:
```
add
CBSKY-046
SKIB-049
```
### `remove`

Remove one or more Title IDs that you put in from the database. This does not affect the same Title IDs shared by the others. Say for example user A and user B both registered the title CBSKY-046, and user A removes it, we will have CBSKY-046 under the name of user B.

Same syntax as the `add` command above.

### `listmine`

You can list all the Title IDs that you added to the database

### `whohas`

You can see who has added the specific Title IDs into the database.

Same syntax as the `add` command above.

## Bot went offline?

If you see that the bot is offline, it has probably crashed and requires my attention. It will not respond to any of your commands. Please send me a message so that I can look at it when I have time.

## Future development

If you found any bugs, of if you would like to request any new features, please open an issue ticket here:
https://github.com/rorisaiko/annbot/issues
